-- =====================================================================
-- GymTrack — Phase 5 migration
-- 1. Optional age and height on gym_profiles.
-- 2. Multiple saved custom workout splits per profile
--    (profile_workout_split_templates) plus an active-split reference on
--    profile_workout_plans.
-- 3. Copies every existing custom schedule into the new collection and keeps
--    the profile's current active selection.
--
-- Run this whole file ONCE in the Supabase Dashboard → SQL Editor, on a
-- project that already has supabase/schema.sql (Phase 3) and
-- 20261107_workout_plans_and_body_weight.sql (Phase 4) applied.
--
-- Safe to run again: every statement is idempotent. It never drops a table,
-- never deletes rows, never disables RLS. The legacy columns
-- profile_workout_plans.split_name / weekly_schedule are KEPT (older app
-- builds still read them, and the new app keeps them in sync).
-- Requires PostgreSQL 15+ (Supabase default) for ON DELETE SET NULL (column).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profile details (nullable: existing profiles stay valid, no invented defaults)
-- ---------------------------------------------------------------------
alter table public.gym_profiles add column if not exists age_years smallint;
alter table public.gym_profiles add column if not exists height_cm numeric(5, 1);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gym_profiles_age_years_check') then
    alter table public.gym_profiles
      add constraint gym_profiles_age_years_check check (age_years is null or age_years between 10 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gym_profiles_height_cm_check') then
    alter table public.gym_profiles
      add constraint gym_profiles_height_cm_check check (height_cm is null or height_cm between 50 and 272);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Saved custom splits (many per profile)
-- weekly_schedule has the same shape as profile_workout_plans.weekly_schedule:
--   { "days": [ { "dayId", "workoutName", "muscleGroupIds": [...], "isRest" }, ... ] }
-- ---------------------------------------------------------------------
create table if not exists public.profile_workout_split_templates (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.gym_profiles (id) on delete cascade,
  split_name       text not null check (char_length(btrim(split_name)) between 1 and 40),
  weekly_schedule  jsonb not null check (jsonb_typeof(weekly_schedule) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Target of the composite foreign key below (template must belong to the same profile).
  constraint profile_workout_split_templates_id_profile_key unique (id, profile_id)
);

create index if not exists profile_workout_split_templates_profile_idx
  on public.profile_workout_split_templates (profile_id);
-- Split names are unique per profile (case-insensitive, trimmed).
create unique index if not exists profile_workout_split_templates_profile_name_key
  on public.profile_workout_split_templates (profile_id, lower(btrim(split_name)));

-- ---------------------------------------------------------------------
-- 3. Active split reference on the existing one-row-per-profile plan table.
--   plan_type = 'PPL'    → built-in PPL is active (active_split_template_id is
--                          kept so the last custom split is remembered).
--   plan_type = 'CUSTOM' → active_split_template_id names the active template.
-- The composite FK guarantees the template belongs to the same profile.
-- Deleting a template only clears the reference (never the plan row).
-- ---------------------------------------------------------------------
alter table public.profile_workout_plans add column if not exists active_split_template_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_workout_plans_active_split_fkey') then
    alter table public.profile_workout_plans
      add constraint profile_workout_plans_active_split_fkey
      foreign key (active_split_template_id, profile_id)
      references public.profile_workout_split_templates (id, profile_id)
      on delete set null (active_split_template_id);
  end if;
end $$;

create index if not exists profile_workout_plans_active_split_idx
  on public.profile_workout_plans (active_split_template_id);

-- ---------------------------------------------------------------------
-- 4. Data migration: copy each existing saved custom schedule into the new
-- collection (one template per profile), then point CUSTOM plans at it.
-- Idempotent: a profile that already has a template with the same name is skipped.
-- ---------------------------------------------------------------------
insert into public.profile_workout_split_templates (profile_id, split_name, weekly_schedule, created_at, updated_at)
select p.profile_id, btrim(p.split_name), p.weekly_schedule, p.created_at, p.updated_at
from public.profile_workout_plans p
where jsonb_typeof(p.weekly_schedule) = 'object'
  and jsonb_typeof(p.weekly_schedule -> 'days') = 'array'
  and not exists (
    select 1 from public.profile_workout_split_templates t
    where t.profile_id = p.profile_id
      and lower(btrim(t.split_name)) = lower(btrim(p.split_name))
  )
on conflict do nothing;

-- Remember the migrated split as the active / last-used custom split.
-- Only rows with no reference yet are touched, so re-running changes nothing.
update public.profile_workout_plans p
set active_split_template_id = t.id
from public.profile_workout_split_templates t
where p.active_split_template_id is null
  and t.profile_id = p.profile_id
  and lower(btrim(t.split_name)) = lower(btrim(p.split_name));

-- ---------------------------------------------------------------------
-- 5. updated_at trigger, privileges, RLS, Realtime for the new table
-- ---------------------------------------------------------------------
drop trigger if exists profile_workout_split_templates_touch_updated_at on public.profile_workout_split_templates;
create trigger profile_workout_split_templates_touch_updated_at
  before update on public.profile_workout_split_templates
  for each row execute function public.touch_updated_at();

revoke all on public.profile_workout_split_templates from anon;
grant select, insert, update, delete on public.profile_workout_split_templates to authenticated;

alter table public.profile_workout_split_templates enable row level security;

drop policy if exists profile_workout_split_templates_select_own on public.profile_workout_split_templates;
drop policy if exists profile_workout_split_templates_insert_own on public.profile_workout_split_templates;
drop policy if exists profile_workout_split_templates_update_own on public.profile_workout_split_templates;
drop policy if exists profile_workout_split_templates_delete_own on public.profile_workout_split_templates;
create policy profile_workout_split_templates_select_own on public.profile_workout_split_templates
  for select to authenticated using (public.owns_gym_profile(profile_id));
create policy profile_workout_split_templates_insert_own on public.profile_workout_split_templates
  for insert to authenticated with check (public.owns_gym_profile(profile_id));
create policy profile_workout_split_templates_update_own on public.profile_workout_split_templates
  for update to authenticated
  using (public.owns_gym_profile(profile_id)) with check (public.owns_gym_profile(profile_id));
create policy profile_workout_split_templates_delete_own on public.profile_workout_split_templates
  for delete to authenticated using (public.owns_gym_profile(profile_id));

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_workout_split_templates'
  ) then
    alter publication supabase_realtime add table public.profile_workout_split_templates;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Optional checks (read-only). Run separately after the migration:
--   select count(*) from public.profile_workout_split_templates;
--   select profile_id, plan_type, split_name, active_split_template_id from public.profile_workout_plans;
--   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- must return no rows
-- ---------------------------------------------------------------------
