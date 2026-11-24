-- =====================================================================
-- GymTrack — Supabase schema (PostgreSQL)
--
-- Run this whole file in the Supabase Dashboard → SQL Editor.
-- It is idempotent: running it again is safe and will not delete data.
--
-- Security model
--   * gym_profiles.owner_id = the authenticated account (auth.users.id).
--   * Every child table references gym_profiles and is protected by an
--     ownership check: the row's profile must belong to auth.uid().
--   * Row Level Security is ENABLED on every table. Policies apply only to
--     the `authenticated` role; `anon` has no table privileges at all.
--   * Profile photos live in the PRIVATE bucket `gym-profile-photos`
--     under `<auth.uid()>/...`; storage policies enforce that prefix.
-- =====================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15+), so no extension is needed.

-- Keeps updated_at current on every UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.gym_profiles (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 30),
  gender              text not null default 'PREFER_NOT_TO_SAY'
                        check (gender in ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
  photo_path          text,
  tracking_start_date date not null default current_date,
  -- Phase 5: optional personal details (null = not provided).
  age_years           smallint,
  height_cm           numeric(5, 1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.gym_profiles (id) on delete cascade,
  date        date not null,
  status      text not null check (status in ('ATTENDED', 'MISSED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint attendance_records_profile_date_key unique (profile_id, date)
);

create table if not exists public.daily_exercise_selections (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.gym_profiles (id) on delete cascade,
  exercise_id  text not null check (char_length(exercise_id) between 1 and 100),
  date         date not null,
  created_at   timestamptz not null default now(),
  constraint daily_exercise_selections_profile_exercise_date_key unique (profile_id, exercise_id, date)
);

create table if not exists public.exercise_set_templates (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.gym_profiles (id) on delete cascade,
  exercise_id        text not null check (char_length(exercise_id) between 1 and 100),
  set_configuration  jsonb not null check (jsonb_typeof(set_configuration) = 'object'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint exercise_set_templates_profile_exercise_key unique (profile_id, exercise_id)
);

create table if not exists public.daily_set_tracker_states (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.gym_profiles (id) on delete cascade,
  exercise_id     text not null check (char_length(exercise_id) between 1 and 100),
  date            date not null,
  completed_sets  smallint[] not null default '{}',
  updated_at      timestamptz not null default now(),
  constraint daily_set_tracker_states_profile_exercise_date_key unique (profile_id, exercise_id, date)
);

create table if not exists public.exercise_personal_records (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.gym_profiles (id) on delete cascade,
  exercise_id   text not null check (char_length(exercise_id) between 1 and 100),
  record_date   date not null,
  best_session  jsonb not null check (jsonb_typeof(best_session) = 'object'),
  notes         text check (notes is null or char_length(notes) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint exercise_personal_records_profile_exercise_key unique (profile_id, exercise_id)
);

-- One workout-plan row per profile. `weekly_schedule` is the custom split and is
-- kept even while plan_type is PPL, so switching back restores it.
create table if not exists public.profile_workout_plans (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.gym_profiles (id) on delete cascade,
  plan_type        text not null default 'PPL' check (plan_type in ('PPL', 'CUSTOM')),
  split_name       text not null default 'My Split' check (char_length(btrim(split_name)) between 1 and 40),
  weekly_schedule  jsonb not null check (jsonb_typeof(weekly_schedule) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Phase 5: many saved custom splits per profile. Names are unique per profile
-- (index below). (id, profile_id) is unique so plans can reference it safely.
create table if not exists public.profile_workout_split_templates (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.gym_profiles (id) on delete cascade,
  split_name       text not null check (char_length(btrim(split_name)) between 1 and 40),
  weekly_schedule  jsonb not null check (jsonb_typeof(weekly_schedule) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profile_workout_split_templates_id_profile_key unique (id, profile_id)
);

-- Existing projects: add the Phase 5 columns (no-ops on fresh installs).
alter table public.gym_profiles add column if not exists age_years smallint;
alter table public.gym_profiles add column if not exists height_cm numeric(5, 1);
-- plan_type 'CUSTOM' uses this template; with 'PPL' it remembers the last custom split.
alter table public.profile_workout_plans add column if not exists active_split_template_id uuid;

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
  -- The active template must belong to the same profile; deleting it only clears the reference.
  if not exists (select 1 from pg_constraint where conname = 'profile_workout_plans_active_split_fkey') then
    alter table public.profile_workout_plans
      add constraint profile_workout_plans_active_split_fkey
      foreign key (active_split_template_id, profile_id)
      references public.profile_workout_split_templates (id, profile_id)
      on delete set null (active_split_template_id);
  end if;
end $$;

-- One body-weight entry per profile per local date. weight_kg is canonical.
create table if not exists public.body_weight_entries (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.gym_profiles (id) on delete cascade,
  recorded_date   date not null,
  weight_kg       numeric(6, 3) not null check (weight_kg > 0 and weight_kg <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint body_weight_entries_profile_date_key unique (profile_id, recorded_date)
);

-- A cloud copy of the original browser data taken during the first import.
create table if not exists public.local_data_backups (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fingerprint  text not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  constraint local_data_backups_owner_fingerprint_key unique (owner_id, fingerprint)
);

-- ---------------------------------------------------------------------
-- Helper: does the current user own this profile?
-- Defined after gym_profiles (SQL functions are validated on creation).
-- SECURITY DEFINER so policies on child tables can check ownership
-- without recursive RLS evaluation; search_path pinned for safety.
-- ---------------------------------------------------------------------
create or replace function public.owns_gym_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gym_profiles p
    where p.id = p_profile_id and p.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists gym_profiles_owner_idx on public.gym_profiles (owner_id);
create unique index if not exists gym_profiles_owner_name_key on public.gym_profiles (owner_id, lower(btrim(name)));
create index if not exists attendance_records_profile_idx on public.attendance_records (profile_id);
create index if not exists daily_exercise_selections_profile_date_idx on public.daily_exercise_selections (profile_id, date);
create index if not exists exercise_set_templates_profile_idx on public.exercise_set_templates (profile_id);
create index if not exists daily_set_tracker_states_profile_date_idx on public.daily_set_tracker_states (profile_id, date);
create index if not exists exercise_personal_records_profile_idx on public.exercise_personal_records (profile_id);
create index if not exists profile_workout_plans_profile_idx on public.profile_workout_plans (profile_id);
create index if not exists body_weight_entries_profile_date_idx on public.body_weight_entries (profile_id, recorded_date);
create index if not exists profile_workout_split_templates_profile_idx on public.profile_workout_split_templates (profile_id);
create unique index if not exists profile_workout_split_templates_profile_name_key
  on public.profile_workout_split_templates (profile_id, lower(btrim(split_name)));
create index if not exists profile_workout_plans_active_split_idx on public.profile_workout_plans (active_split_template_id);

-- Phase 5 data copy (idempotent; no-op on fresh installs): every legacy custom
-- schedule becomes a saved split, and the plan remembers it as its custom split.
insert into public.profile_workout_split_templates (profile_id, split_name, weekly_schedule, created_at, updated_at)
select p.profile_id, btrim(p.split_name), p.weekly_schedule, p.created_at, p.updated_at
from public.profile_workout_plans p
where jsonb_typeof(p.weekly_schedule) = 'object'
  -- Phase 6 replaces this copy with the shared library; never add per-profile copies after it.
  and to_regclass('public.workout_split_migration_log') is null
  and jsonb_typeof(p.weekly_schedule -> 'days') = 'array'
  and not exists (
    select 1 from public.profile_workout_split_templates t
    where t.profile_id = p.profile_id and lower(btrim(t.split_name)) = lower(btrim(p.split_name))
  )
on conflict do nothing;

update public.profile_workout_plans p
set active_split_template_id = t.id
from public.profile_workout_split_templates t
where p.active_split_template_id is null
  and to_regclass('public.workout_split_migration_log') is null
  and t.profile_id = p.profile_id
  and lower(btrim(t.split_name)) = lower(btrim(p.split_name));

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['gym_profiles', 'attendance_records', 'exercise_set_templates',
                           'daily_set_tracker_states', 'exercise_personal_records',
                           'profile_workout_plans', 'body_weight_entries', 'profile_workout_split_templates']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Privileges: nothing for anonymous visitors, CRUD for signed-in users
-- (RLS below still restricts which ROWS they can touch).
-- ---------------------------------------------------------------------
revoke all on public.gym_profiles, public.attendance_records, public.daily_exercise_selections,
              public.exercise_set_templates, public.daily_set_tracker_states,
              public.exercise_personal_records, public.profile_workout_plans,
              public.body_weight_entries, public.profile_workout_split_templates, public.local_data_backups
  from anon;
grant select, insert, update, delete on public.gym_profiles, public.attendance_records,
              public.daily_exercise_selections, public.exercise_set_templates,
              public.daily_set_tracker_states, public.exercise_personal_records,
              public.profile_workout_plans, public.body_weight_entries, public.profile_workout_split_templates
  to authenticated;
grant select, insert on public.local_data_backups to authenticated;
revoke all on function public.owns_gym_profile(uuid) from public, anon;
grant execute on function public.owns_gym_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.gym_profiles              enable row level security;
alter table public.attendance_records        enable row level security;
alter table public.daily_exercise_selections enable row level security;
alter table public.exercise_set_templates    enable row level security;
alter table public.daily_set_tracker_states  enable row level security;
alter table public.exercise_personal_records enable row level security;
alter table public.profile_workout_plans     enable row level security;
alter table public.body_weight_entries       enable row level security;
alter table public.profile_workout_split_templates enable row level security;
alter table public.local_data_backups        enable row level security;

-- Profiles: only the owner, and owner_id can never be changed to someone else.
drop policy if exists "gym_profiles_select_own" on public.gym_profiles;
drop policy if exists "gym_profiles_insert_own" on public.gym_profiles;
drop policy if exists "gym_profiles_update_own" on public.gym_profiles;
drop policy if exists "gym_profiles_delete_own" on public.gym_profiles;
create policy "gym_profiles_select_own" on public.gym_profiles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "gym_profiles_insert_own" on public.gym_profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "gym_profiles_update_own" on public.gym_profiles
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "gym_profiles_delete_own" on public.gym_profiles
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Child tables: the referenced profile must belong to the current user,
-- both for existing rows (USING) and for new / changed rows (WITH CHECK).
do $$
declare t text;
begin
  foreach t in array array['attendance_records', 'daily_exercise_selections', 'exercise_set_templates',
                           'daily_set_tracker_states', 'exercise_personal_records',
                           'profile_workout_plans', 'body_weight_entries', 'profile_workout_split_templates']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_gym_profile(profile_id))',
                   t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.owns_gym_profile(profile_id))',
                   t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.owns_gym_profile(profile_id)) with check (public.owns_gym_profile(profile_id))',
                   t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.owns_gym_profile(profile_id))',
                   t || '_delete_own', t);
  end loop;
end $$;

drop policy if exists "local_data_backups_select_own" on public.local_data_backups;
drop policy if exists "local_data_backups_insert_own" on public.local_data_backups;
create policy "local_data_backups_select_own" on public.local_data_backups
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "local_data_backups_insert_own" on public.local_data_backups
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Storage: private bucket for profile photos (256 × 256 WebP/JPEG, ≤ 1 MB)
-- Object paths: <auth.uid()>/<profile id>/<timestamp>.webp
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-profile-photos', 'gym-profile-photos', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gym_photos_select_own" on storage.objects;
drop policy if exists "gym_photos_insert_own" on storage.objects;
drop policy if exists "gym_photos_update_own" on storage.objects;
drop policy if exists "gym_photos_delete_own" on storage.objects;
create policy "gym_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Realtime: publish row changes (Realtime still applies RLS per user).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['gym_profiles', 'attendance_records', 'daily_exercise_selections',
                           'exercise_set_templates', 'daily_set_tracker_states', 'exercise_personal_records',
                           'profile_workout_plans', 'body_weight_entries', 'profile_workout_split_templates']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- =====================================================================
-- Phase 6 (identical to supabase/migrations/20261109_phase6_shared_splits_themes_pins.sql;
-- idempotent, so fresh installs and re-runs are both safe)
-- =====================================================================
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Profile theme
-- ---------------------------------------------------------------------
alter table public.gym_profiles add column if not exists theme_key text not null default 'lime';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gym_profiles_theme_key_check') then
    alter table public.gym_profiles add constraint gym_profiles_theme_key_check
      check (theme_key in ('lime', 'blue', 'purple', 'crimson', 'amber', 'teal', 'rose', 'slate'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Shared split library (one per account). No unique name constraint on
-- purpose: migrated splits with the same name from different profiles are
-- all kept (the app prevents NEW duplicate names).
-- ---------------------------------------------------------------------
create table if not exists public.account_workout_split_templates (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Migration provenance / creating profile. Deleting that profile keeps the shared split.
  source_profile_id  uuid references public.gym_profiles (id) on delete set null,
  split_name         text not null check (char_length(btrim(split_name)) between 1 and 40),
  weekly_schedule    jsonb not null check (jsonb_typeof(weekly_schedule) = 'object'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists account_workout_split_templates_owner_idx on public.account_workout_split_templates (owner_id);
create index if not exists account_workout_split_templates_source_profile_idx on public.account_workout_split_templates (source_profile_id);

-- The ACTIVE split stays per profile: plan_type 'PPL' = built-in,
-- 'CUSTOM' = active_account_split_id. With 'PPL' it remembers the last custom split.
alter table public.profile_workout_plans add column if not exists active_account_split_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_workout_plans_active_account_split_fkey') then
    alter table public.profile_workout_plans
      add constraint profile_workout_plans_active_account_split_fkey
      foreign key (active_account_split_id) references public.account_workout_split_templates (id) on delete set null;
  end if;
end $$;
create index if not exists profile_workout_plans_active_account_split_idx on public.profile_workout_plans (active_account_split_id);

-- A profile may only point at a split owned by the SAME account (never trust the client).
create or replace function public.check_active_account_split()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_account_split_id is not null and not exists (
    select 1
    from public.account_workout_split_templates t
    join public.gym_profiles p on p.id = new.profile_id
    where t.id = new.active_account_split_id and t.owner_id = p.owner_id
  ) then
    raise exception 'That workout split does not belong to this account.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profile_workout_plans_check_active_account_split on public.profile_workout_plans;
create trigger profile_workout_plans_check_active_account_split
  before insert or update of active_account_split_id, profile_id on public.profile_workout_plans
  for each row execute function public.check_active_account_split();

-- ---------------------------------------------------------------------
-- 3. Copy existing splits into the shared library (once per source row).
-- ---------------------------------------------------------------------
create table if not exists public.workout_split_migration_log (
  source_key   text primary key,           -- 'profile-template:<id>' or 'legacy-plan:<plan id>'
  target_id    uuid not null,
  migrated_at  timestamptz not null default now()
);
alter table public.workout_split_migration_log enable row level security;
revoke all on public.workout_split_migration_log from anon, authenticated;

do $$
declare
  source_row record;
  new_template_id uuid;
  already_copied_by_phase5 boolean;
  has_profile_templates boolean := to_regclass('public.profile_workout_split_templates') is not null;
  has_phase5_reference boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_workout_plans' and column_name = 'active_split_template_id'
  );
begin
  -- 3a. Phase 5 per-profile splits → same id, name, schedule, dates; source profile kept.
  if has_profile_templates then
    for source_row in execute
      'select t.id, t.profile_id, t.split_name, t.weekly_schedule, t.created_at, t.updated_at, p.owner_id
         from public.profile_workout_split_templates t
         join public.gym_profiles p on p.id = t.profile_id
        order by t.created_at, t.id'
    loop
      continue when exists (select 1 from public.workout_split_migration_log where source_key = 'profile-template:' || source_row.id);
      insert into public.account_workout_split_templates (id, owner_id, source_profile_id, split_name, weekly_schedule, created_at, updated_at)
      values (source_row.id, source_row.owner_id, source_row.profile_id, btrim(source_row.split_name),
              source_row.weekly_schedule, source_row.created_at, source_row.updated_at)
      on conflict (id) do nothing;
      insert into public.workout_split_migration_log (source_key, target_id)
      values ('profile-template:' || source_row.id, source_row.id);
    end loop;

    -- Keep each profile's active Phase 5 split active (same id in the shared library).
    if has_phase5_reference then
      execute
        'update public.profile_workout_plans pl
            set active_account_split_id = pl.active_split_template_id
          where pl.active_account_split_id is null
            and pl.active_split_template_id is not null
            and exists (select 1 from public.account_workout_split_templates a where a.id = pl.active_split_template_id)
            and not exists (select 1 from public.workout_split_migration_log l where l.source_key = ''active:'' || pl.id)';
      insert into public.workout_split_migration_log (source_key, target_id)
      select 'active:' || pl.id, pl.active_account_split_id
      from public.profile_workout_plans pl
      where pl.active_account_split_id is not null
      on conflict (source_key) do nothing;
    end if;
  end if;

  -- 3b. Legacy single custom split stored on the plan row (Phase 4), when Phase 5
  -- did not already turn it into a saved split. Gets a new id; becomes the active
  -- / remembered custom split of that profile.
  for source_row in
    select pl.id, pl.profile_id, pl.split_name, pl.weekly_schedule, pl.created_at, pl.updated_at,
           pl.active_account_split_id, p.owner_id
    from public.profile_workout_plans pl
    join public.gym_profiles p on p.id = pl.profile_id
    where jsonb_typeof(pl.weekly_schedule -> 'days') = 'array'
      and char_length(btrim(pl.split_name)) between 1 and 40
    order by pl.created_at, pl.id
  loop
    continue when exists (select 1 from public.workout_split_migration_log where source_key = 'legacy-plan:' || source_row.id);
    already_copied_by_phase5 := false;
    if has_profile_templates then
      execute 'select exists (select 1 from public.profile_workout_split_templates t
                               where t.profile_id = $1 and lower(btrim(t.split_name)) = lower(btrim($2)))'
        into already_copied_by_phase5
        using source_row.profile_id, source_row.split_name;
    end if;
    if already_copied_by_phase5 then
      insert into public.workout_split_migration_log (source_key, target_id)
      values ('legacy-plan:' || source_row.id, coalesce(source_row.active_account_split_id, source_row.id));
      continue;
    end if;
    insert into public.account_workout_split_templates (owner_id, source_profile_id, split_name, weekly_schedule, created_at, updated_at)
    values (source_row.owner_id, source_row.profile_id, btrim(source_row.split_name), source_row.weekly_schedule,
            source_row.created_at, source_row.updated_at)
    returning id into new_template_id;
    update public.profile_workout_plans
       set active_account_split_id = new_template_id
     where id = source_row.id and active_account_split_id is null;
    insert into public.workout_split_migration_log (source_key, target_id)
    values ('legacy-plan:' || source_row.id, new_template_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Shared library: trigger, privileges, RLS (account ownership), Realtime
-- ---------------------------------------------------------------------
drop trigger if exists account_workout_split_templates_touch_updated_at on public.account_workout_split_templates;
create trigger account_workout_split_templates_touch_updated_at
  before update on public.account_workout_split_templates
  for each row execute function public.touch_updated_at();

revoke all on public.account_workout_split_templates from anon;
grant select, insert, update, delete on public.account_workout_split_templates to authenticated;
alter table public.account_workout_split_templates enable row level security;

drop policy if exists account_workout_split_templates_select_own on public.account_workout_split_templates;
drop policy if exists account_workout_split_templates_insert_own on public.account_workout_split_templates;
drop policy if exists account_workout_split_templates_update_own on public.account_workout_split_templates;
drop policy if exists account_workout_split_templates_delete_own on public.account_workout_split_templates;
create policy account_workout_split_templates_select_own on public.account_workout_split_templates
  for select to authenticated using (owner_id = (select auth.uid()));
create policy account_workout_split_templates_insert_own on public.account_workout_split_templates
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (source_profile_id is null or public.owns_gym_profile(source_profile_id)));
create policy account_workout_split_templates_update_own on public.account_workout_split_templates
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (source_profile_id is null or public.owns_gym_profile(source_profile_id)));
create policy account_workout_split_templates_delete_own on public.account_workout_split_templates
  for delete to authenticated using (owner_id = (select auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_workout_split_templates'
  ) then
    alter publication supabase_realtime add table public.account_workout_split_templates;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Profile PIN lock
-- The table has RLS on and NO grants for anon/authenticated: hashes can never be
-- selected through the API or Realtime. All access goes through the functions
-- below, which check auth.uid() ownership and enforce the lockout server-side.
-- ---------------------------------------------------------------------
create table if not exists public.profile_pin_security (
  profile_id       uuid primary key references public.gym_profiles (id) on delete cascade,
  pin_hash         text not null,                 -- bcrypt (pgcrypto crypt + gen_salt('bf'))
  failed_attempts  smallint not null default 0,
  lockout_count    smallint not null default 0,   -- grows the lockout after repeated lockouts
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.profile_pin_security enable row level security;
revoke all on public.profile_pin_security from anon, authenticated;
drop trigger if exists profile_pin_security_touch_updated_at on public.profile_pin_security;
create trigger profile_pin_security_touch_updated_at
  before update on public.profile_pin_security
  for each row execute function public.touch_updated_at();

-- Internal: checks a PIN, counts failures, applies the lockout. Never returns the hash.
-- 5 wrong PINs in a row → locked for 1, 2, 4, … minutes (max 60) on each new lockout.
create or replace function public.profile_pin_check_internal(p_profile_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  security_row public.profile_pin_security%rowtype;
  lockout_minutes integer;
begin
  select * into security_row from public.profile_pin_security where profile_id = p_profile_id for update;
  if not found then
    return jsonb_build_object('ok', true, 'hasPin', false);
  end if;
  if security_row.locked_until is not null and security_row.locked_until > now() then
    return jsonb_build_object('ok', false, 'hasPin', true, 'lockedUntil', security_row.locked_until, 'attemptsRemaining', 0);
  end if;
  if p_pin ~ '^[0-9]{4}$' and extensions.crypt(p_pin, security_row.pin_hash) = security_row.pin_hash then
    update public.profile_pin_security
       set failed_attempts = 0, lockout_count = 0, locked_until = null
     where profile_id = p_profile_id;
    return jsonb_build_object('ok', true, 'hasPin', true);
  end if;
  if security_row.failed_attempts + 1 >= 5 then
    lockout_minutes := least(60, power(2, least(security_row.lockout_count, 6))::integer);
    update public.profile_pin_security
       set failed_attempts = 0,
           lockout_count = least(security_row.lockout_count + 1, 32000),
           locked_until = now() + make_interval(mins => lockout_minutes)
     where profile_id = p_profile_id
     returning * into security_row;
    return jsonb_build_object('ok', false, 'hasPin', true, 'lockedUntil', security_row.locked_until, 'attemptsRemaining', 0);
  end if;
  update public.profile_pin_security
     set failed_attempts = security_row.failed_attempts + 1
   where profile_id = p_profile_id;
  return jsonb_build_object('ok', false, 'hasPin', true, 'attemptsRemaining', 5 - (security_row.failed_attempts + 1));
end;
$$;

-- Which of MY profiles are locked (no hashes).
create or replace function public.list_locked_profiles()
returns table (profile_id uuid, locked_until timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.profile_id, case when s.locked_until > now() then s.locked_until end
  from public.profile_pin_security s
  join public.gym_profiles p on p.id = s.profile_id
  where p.owner_id = (select auth.uid());
$$;

create or replace function public.verify_profile_pin(p_profile_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.owns_gym_profile(p_profile_id) then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;
  return public.profile_pin_check_internal(p_profile_id, p_pin);
end;
$$;

-- Enable or change the PIN. Changing requires the current PIN (rate limited).
create or replace function public.set_profile_pin(p_profile_id uuid, p_new_pin text, p_current_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  check_result jsonb;
begin
  if not public.owns_gym_profile(p_profile_id) then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid-pin');
  end if;
  if exists (select 1 from public.profile_pin_security where profile_id = p_profile_id) then
    check_result := public.profile_pin_check_internal(p_profile_id, coalesce(p_current_pin, ''));
    if not (check_result ->> 'ok')::boolean then
      return check_result || jsonb_build_object('error', 'wrong-current-pin');
    end if;
  end if;
  insert into public.profile_pin_security (profile_id, pin_hash)
  values (p_profile_id, extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)))
  on conflict (profile_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, lockout_count = 0, locked_until = null;
  -- Bump the profile so other devices re-read the lock state through Realtime.
  update public.gym_profiles set updated_at = now() where id = p_profile_id;
  return jsonb_build_object('ok', true, 'hasPin', true);
end;
$$;

-- Remove the PIN. Requires the current PIN (rate limited).
create or replace function public.remove_profile_pin(p_profile_id uuid, p_current_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  check_result jsonb;
begin
  if not public.owns_gym_profile(p_profile_id) then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;
  check_result := public.profile_pin_check_internal(p_profile_id, coalesce(p_current_pin, ''));
  if not (check_result ->> 'ok')::boolean then
    return check_result || jsonb_build_object('error', 'wrong-current-pin');
  end if;
  delete from public.profile_pin_security where profile_id = p_profile_id;
  update public.gym_profiles set updated_at = now() where id = p_profile_id;
  return jsonb_build_object('ok', true, 'hasPin', false);
end;
$$;

-- Forgot PIN: the account owner signs in again (password) and then has 10 minutes
-- to clear the PIN. The check uses the JWT 'amr' timestamp issued by Supabase Auth
-- for that sign-in, so a merely refreshed old session is not enough.
create or replace function public.reset_profile_pin_after_reauth(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  recently_authenticated boolean;
begin
  if not public.owns_gym_profile(p_profile_id) then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
    where jsonb_typeof(method -> 'timestamp') = 'number'
      and (method ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600
  ) into recently_authenticated;
  if not recently_authenticated then
    return jsonb_build_object('ok', false, 'error', 'reauthentication-required');
  end if;
  delete from public.profile_pin_security where profile_id = p_profile_id;
  update public.gym_profiles set updated_at = now() where id = p_profile_id;
  return jsonb_build_object('ok', true, 'hasPin', false);
end;
$$;

revoke all on function public.profile_pin_check_internal(uuid, text) from public, anon, authenticated;
revoke all on function public.list_locked_profiles() from public, anon;
revoke all on function public.verify_profile_pin(uuid, text) from public, anon;
revoke all on function public.set_profile_pin(uuid, text, text) from public, anon;
revoke all on function public.remove_profile_pin(uuid, text) from public, anon;
revoke all on function public.reset_profile_pin_after_reauth(uuid) from public, anon;
revoke all on function public.check_active_account_split() from public, anon, authenticated;
grant execute on function public.list_locked_profiles() to authenticated;
grant execute on function public.verify_profile_pin(uuid, text) to authenticated;
grant execute on function public.set_profile_pin(uuid, text, text) to authenticated;
grant execute on function public.remove_profile_pin(uuid, text) to authenticated;
grant execute on function public.reset_profile_pin_after_reauth(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Read-only checks (run separately after the migration):
--   select count(*) as shared_splits from public.account_workout_split_templates;
--   select source_key, target_id from public.workout_split_migration_log order by migrated_at;
--   select profile_id, plan_type, active_account_split_id from public.profile_workout_plans;
--   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
-- ---------------------------------------------------------------------


-- =====================================================================
-- Phase 7 (identical to supabase/migrations/20261124_phase7_form_videos_custom_theme.sql;
-- idempotent, so fresh installs and re-runs are both safe)
-- =====================================================================
-- ---------------------------------------------------------------------
-- 1. Custom profile colour
-- ---------------------------------------------------------------------
alter table public.gym_profiles add column if not exists custom_theme_color text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gym_profiles_custom_theme_color_check') then
    alter table public.gym_profiles add constraint gym_profiles_custom_theme_color_check
      check (custom_theme_color is null or custom_theme_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Form-reference videos (many per profile + variation)
-- ---------------------------------------------------------------------
create table if not exists public.profile_exercise_form_videos (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.gym_profiles (id) on delete cascade,
  -- Stable library variation id (same text ids as exercise_set_templates / PRs).
  exercise_id  text not null check (char_length(exercise_id) between 1 and 100),
  video_name   text not null check (char_length(btrim(video_name)) between 1 and 80),
  video_url    text not null check (char_length(video_url) between 10 and 2048 and video_url ~* '^https?://[^[:space:]]+$'),
  platform     text not null check (platform in ('YOUTUBE', 'INSTAGRAM', 'OTHER')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists profile_exercise_form_videos_profile_exercise_idx
  on public.profile_exercise_form_videos (profile_id, exercise_id);

drop trigger if exists profile_exercise_form_videos_touch_updated_at on public.profile_exercise_form_videos;
create trigger profile_exercise_form_videos_touch_updated_at
  before update on public.profile_exercise_form_videos
  for each row execute function public.touch_updated_at();

revoke all on public.profile_exercise_form_videos from anon;
grant select, insert, update, delete on public.profile_exercise_form_videos to authenticated;
alter table public.profile_exercise_form_videos enable row level security;

-- Same ownership model as every other profile child table.
drop policy if exists profile_exercise_form_videos_select_own on public.profile_exercise_form_videos;
drop policy if exists profile_exercise_form_videos_insert_own on public.profile_exercise_form_videos;
drop policy if exists profile_exercise_form_videos_update_own on public.profile_exercise_form_videos;
drop policy if exists profile_exercise_form_videos_delete_own on public.profile_exercise_form_videos;
create policy profile_exercise_form_videos_select_own on public.profile_exercise_form_videos
  for select to authenticated using (public.owns_gym_profile(profile_id));
create policy profile_exercise_form_videos_insert_own on public.profile_exercise_form_videos
  for insert to authenticated with check (public.owns_gym_profile(profile_id));
create policy profile_exercise_form_videos_update_own on public.profile_exercise_form_videos
  for update to authenticated
  using (public.owns_gym_profile(profile_id)) with check (public.owns_gym_profile(profile_id));
create policy profile_exercise_form_videos_delete_own on public.profile_exercise_form_videos
  for delete to authenticated using (public.owns_gym_profile(profile_id));

-- Realtime: the app keeps every synced table live across devices (a video added on
-- the phone appears on the laptop). RLS still limits events to the owning account.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_exercise_form_videos'
  ) then
    alter publication supabase_realtime add table public.profile_exercise_form_videos;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Card background images (profile cards and weekly day cards)
-- One row per profile + card: card_key 'profile' (the Profiles page tile) or a
-- weekday ('monday' … 'sunday', that profile's weekly plan day card). Backgrounds
-- are per PROFILE and per WEEKDAY — not part of the shared split JSON — so they
-- never leak to other profiles, survive switching splits, and Copy From Another
-- Day (which copies split JSON) never overwrites them.
--
-- Images live in the existing PRIVATE bucket `gym-profile-photos` under
--   <auth.uid()>/<profile id>/backgrounds/<file>
-- The bucket's existing policies already limit every object to its owner's
-- <auth.uid()>/ folder; the policies below also require the stored path to sit
-- in that profile's own backgrounds folder. No storage policy is changed and
-- nothing becomes public (the app shows images through short-lived signed URLs).
-- ---------------------------------------------------------------------
create table if not exists public.profile_card_backgrounds (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.gym_profiles (id) on delete cascade,
  card_key      text not null check (card_key in ('profile', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  storage_path  text not null check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/backgrounds/[A-Za-z0-9._-]{1,120}$'),
  dim_percent   smallint not null default 45 check (dim_percent between 0 and 90),
  blur_px       smallint not null default 0 check (blur_px between 0 and 20),
  focal_x       smallint not null default 50 check (focal_x between 0 and 100),
  focal_y       smallint not null default 50 check (focal_y between 0 and 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profile_card_backgrounds_profile_card_key unique (profile_id, card_key)
);
create index if not exists profile_card_backgrounds_profile_idx on public.profile_card_backgrounds (profile_id);

drop trigger if exists profile_card_backgrounds_touch_updated_at on public.profile_card_backgrounds;
create trigger profile_card_backgrounds_touch_updated_at
  before update on public.profile_card_backgrounds
  for each row execute function public.touch_updated_at();

revoke all on public.profile_card_backgrounds from anon;
grant select, insert, update, delete on public.profile_card_backgrounds to authenticated;
alter table public.profile_card_backgrounds enable row level security;

drop policy if exists profile_card_backgrounds_select_own on public.profile_card_backgrounds;
drop policy if exists profile_card_backgrounds_delete_own on public.profile_card_backgrounds;
create policy profile_card_backgrounds_select_own on public.profile_card_backgrounds
  for select to authenticated using (public.owns_gym_profile(profile_id));
-- A row may only point at a file in the caller's own folder for THAT profile.
-- Skipped once the Phase 8b gallery exists (its policies replace these).
do $guard$
begin
  if to_regclass('public.account_background_images') is null then
    execute $p$ drop policy if exists profile_card_backgrounds_insert_own on public.profile_card_backgrounds $p$;
    execute $p$ drop policy if exists profile_card_backgrounds_update_own on public.profile_card_backgrounds $p$;
    execute $p$ create policy profile_card_backgrounds_insert_own on public.profile_card_backgrounds
  for insert to authenticated
  with check (
    public.owns_gym_profile(profile_id)
    and storage_path like ((select auth.uid())::text || '/' || profile_id::text || '/backgrounds/%')
  ) $p$;
    execute $p$ create policy profile_card_backgrounds_update_own on public.profile_card_backgrounds
  for update to authenticated
  using (public.owns_gym_profile(profile_id))
  with check (
    public.owns_gym_profile(profile_id)
    and storage_path like ((select auth.uid())::text || '/' || profile_id::text || '/backgrounds/%')
  ) $p$;
  end if;
end $guard$;
create policy profile_card_backgrounds_delete_own on public.profile_card_backgrounds
  for delete to authenticated using (public.owns_gym_profile(profile_id));

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profile_card_backgrounds'
  ) then
    alter publication supabase_realtime add table public.profile_card_backgrounds;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Read-only checks (run separately afterwards):
--   select column_name from information_schema.columns where table_name = 'gym_profiles' and column_name = 'custom_theme_color';
--   select count(*) from public.profile_exercise_form_videos;
--   select count(*) from public.profile_card_backgrounds;
--   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
-- ---------------------------------------------------------------------


-- =====================================================================
-- Phase 8 (identical to supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql;
-- idempotent, so fresh installs and re-runs are both safe)
-- =====================================================================
do $$
begin
  if to_regclass('public.profile_card_backgrounds') is null or to_regclass('public.profile_exercise_form_videos') is null then
    raise exception 'Run the Phase 7 migration (20261124_phase7_form_videos_custom_theme.sql) first.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Profile picture visibility on the profile card
-- ---------------------------------------------------------------------
alter table public.gym_profiles add column if not exists show_photo_on_card boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. Zoom for profile-card backgrounds (100 % = the image just covers the card)
-- ---------------------------------------------------------------------
alter table public.profile_card_backgrounds add column if not exists zoom_percent smallint not null default 100;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_card_backgrounds_zoom_percent_check') then
    alter table public.profile_card_backgrounds add constraint profile_card_backgrounds_zoom_percent_check
      check (zoom_percent between 100 and 300);
  end if;
end $$;

-- Copy log for this file's one-time data copies (not readable by app users).
create table if not exists public.phase8_migration_log (
  source_key   text primary key,           -- 'form-video:<old id>' or 'day-background:<old id>'
  target_id    uuid,
  migrated_at  timestamptz not null default now()
);
alter table public.phase8_migration_log enable row level security;
revoke all on public.phase8_migration_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Weekly day-card backgrounds per SHARED split + weekday
-- Images stay in the PRIVATE bucket `gym-profile-photos`, inside the owner's
-- <auth.uid()>/ folder (the existing storage policies already enforce that):
--   new uploads:  <user>/splits/backgrounds/<file>
--   copied rows:  <user>/<profile>/backgrounds/<file>   (the Phase 7 file, reused)
-- Several rows (days, splits) may point at the SAME file: "Copy Background"
-- and "Duplicate split" reuse the reference instead of uploading again. The app
-- deletes a file only when no row (and no avatar) references it any more.
-- ---------------------------------------------------------------------
create table if not exists public.account_split_day_backgrounds (
  id            uuid primary key default gen_random_uuid(),
  split_id      uuid not null references public.account_workout_split_templates (id) on delete cascade,
  day_id        text not null check (day_id in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  storage_path  text not null check (storage_path ~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|splits)/backgrounds/[A-Za-z0-9._-]{1,120}$'),
  dim_percent   smallint not null default 45 check (dim_percent between 0 and 90),
  blur_px       smallint not null default 0 check (blur_px between 0 and 20),
  zoom_percent  smallint not null default 100 check (zoom_percent between 100 and 300),
  focal_x       smallint not null default 50 check (focal_x between 0 and 100),
  focal_y       smallint not null default 50 check (focal_y between 0 and 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint account_split_day_backgrounds_split_day_key unique (split_id, day_id)
);
create index if not exists account_split_day_backgrounds_storage_path_idx on public.account_split_day_backgrounds (storage_path);

drop trigger if exists account_split_day_backgrounds_touch_updated_at on public.account_split_day_backgrounds;
create trigger account_split_day_backgrounds_touch_updated_at
  before update on public.account_split_day_backgrounds
  for each row execute function public.touch_updated_at();

revoke all on public.account_split_day_backgrounds from anon;
grant select, insert, update, delete on public.account_split_day_backgrounds to authenticated;
alter table public.account_split_day_backgrounds enable row level security;

-- Same owner as the split; a row may only point at a file in the caller's own folder.
drop policy if exists account_split_day_backgrounds_select_own on public.account_split_day_backgrounds;
drop policy if exists account_split_day_backgrounds_delete_own on public.account_split_day_backgrounds;
create policy account_split_day_backgrounds_select_own on public.account_split_day_backgrounds
  for select to authenticated
  using (exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid())));
-- Skipped once the Phase 8b gallery exists (its policies replace these).
do $guard$
begin
  if to_regclass('public.account_background_images') is null then
    execute $p$ drop policy if exists account_split_day_backgrounds_insert_own on public.account_split_day_backgrounds $p$;
    execute $p$ drop policy if exists account_split_day_backgrounds_update_own on public.account_split_day_backgrounds $p$;
    execute $p$ create policy account_split_day_backgrounds_insert_own on public.account_split_day_backgrounds
  for insert to authenticated
  with check (
    exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid()))
    and storage_path like ((select auth.uid())::text || '/%')
  ) $p$;
    execute $p$ create policy account_split_day_backgrounds_update_own on public.account_split_day_backgrounds
  for update to authenticated
  using (exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid()))
    and storage_path like ((select auth.uid())::text || '/%')
  ) $p$;
  end if;
end $guard$;
create policy account_split_day_backgrounds_delete_own on public.account_split_day_backgrounds
  for delete to authenticated
  using (exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid())));

-- Copy each Phase 7 per-profile day background to that profile's custom split
-- (active, or remembered while PPL is active). If several profiles share the split,
-- the most recently updated background of each weekday wins. Same file, no upload.
do $$
declare
  source_row record;
  new_id uuid;
begin
  for source_row in
    select distinct on (pl.active_account_split_id, b.card_key)
           b.id, pl.active_account_split_id as split_id, b.card_key, b.storage_path,
           b.dim_percent, b.blur_px, b.focal_x, b.focal_y
      from public.profile_card_backgrounds b
      join public.profile_workout_plans pl on pl.profile_id = b.profile_id
      join public.account_workout_split_templates t on t.id = pl.active_account_split_id
      join public.gym_profiles p on p.id = b.profile_id and p.owner_id = t.owner_id
     where b.card_key <> 'profile'
       and pl.active_account_split_id is not null
       and b.storage_path like (t.owner_id::text || '/%')
     order by pl.active_account_split_id, b.card_key, b.updated_at desc, b.id
  loop
    continue when exists (select 1 from public.phase8_migration_log where source_key = 'day-background:' || source_row.id);
    insert into public.account_split_day_backgrounds (split_id, day_id, storage_path, dim_percent, blur_px, focal_x, focal_y)
    values (source_row.split_id, source_row.card_key, source_row.storage_path,
            source_row.dim_percent, source_row.blur_px, source_row.focal_x, source_row.focal_y)
    on conflict (split_id, day_id) do nothing
    returning id into new_id;
    insert into public.phase8_migration_log (source_key, target_id)
    values ('day-background:' || source_row.id, new_id)
    on conflict (source_key) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4a. Shared form videos (every signed-in account reads them)
-- Who may do what (RLS):
--   read            any signed-in user (authenticated role); never anon
--   add             any signed-in user; created_by is always the caller
--   edit / delete   only the account that added the video (created_by)
--   hide            per profile, private (profile_hidden_form_videos below)
-- One copy per variation + URL (unique index), so the same link isn't shared twice.
-- ---------------------------------------------------------------------
create table if not exists public.exercise_form_videos (
  id           uuid primary key default gen_random_uuid(),
  -- Stable library variation id (same text ids as exercise_set_templates / PRs).
  exercise_id  text not null check (char_length(exercise_id) between 1 and 100),
  video_name   text not null check (char_length(btrim(video_name)) between 1 and 80),
  video_url    text not null check (char_length(video_url) between 10 and 2048 and video_url ~* '^https?://[^[:space:]]+$'),
  platform     text not null check (platform in ('YOUTUBE', 'INSTAGRAM', 'OTHER')),
  -- The adding account. Kept NULL if that account is deleted (the video stays shared).
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists exercise_form_videos_exercise_url_key on public.exercise_form_videos (exercise_id, video_url);
create index if not exists exercise_form_videos_created_by_idx on public.exercise_form_videos (created_by);

drop trigger if exists exercise_form_videos_touch_updated_at on public.exercise_form_videos;
create trigger exercise_form_videos_touch_updated_at
  before update on public.exercise_form_videos
  for each row execute function public.touch_updated_at();

revoke all on public.exercise_form_videos from anon;
grant select, insert, update, delete on public.exercise_form_videos to authenticated;
alter table public.exercise_form_videos enable row level security;

drop policy if exists exercise_form_videos_select_authenticated on public.exercise_form_videos;
drop policy if exists exercise_form_videos_insert_own on public.exercise_form_videos;
drop policy if exists exercise_form_videos_update_own on public.exercise_form_videos;
drop policy if exists exercise_form_videos_delete_own on public.exercise_form_videos;
create policy exercise_form_videos_select_authenticated on public.exercise_form_videos
  for select to authenticated using (true);
create policy exercise_form_videos_insert_own on public.exercise_form_videos
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy exercise_form_videos_update_own on public.exercise_form_videos
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy exercise_form_videos_delete_own on public.exercise_form_videos
  for delete to authenticated using (created_by = (select auth.uid()));

-- Copy the Phase 7 per-profile videos (metadata, dates and the first copy's id kept).
do $$
declare
  source_row record;
  shared_id uuid;
begin
  for source_row in
    select v.id, v.exercise_id, btrim(v.video_name) as video_name, v.video_url, v.platform, v.created_at, v.updated_at, p.owner_id
      from public.profile_exercise_form_videos v
      join public.gym_profiles p on p.id = v.profile_id
     order by v.created_at, v.id
  loop
    continue when exists (select 1 from public.phase8_migration_log where source_key = 'form-video:' || source_row.id);
    select id into shared_id from public.exercise_form_videos
     where exercise_id = source_row.exercise_id and video_url = source_row.video_url;
    if shared_id is null then
      insert into public.exercise_form_videos (id, exercise_id, video_name, video_url, platform, created_by, created_at, updated_at)
      values (source_row.id, source_row.exercise_id, source_row.video_name, source_row.video_url, source_row.platform,
              source_row.owner_id, source_row.created_at, source_row.updated_at)
      on conflict do nothing
      returning id into shared_id;
    end if;
    insert into public.phase8_migration_log (source_key, target_id)
    values ('form-video:' || source_row.id, shared_id)
    on conflict (source_key) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4b. Per-profile hidden videos (private to the profile's account)
-- ---------------------------------------------------------------------
create table if not exists public.profile_hidden_form_videos (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.gym_profiles (id) on delete cascade,
  video_id    uuid not null references public.exercise_form_videos (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profile_hidden_form_videos_profile_video_key unique (profile_id, video_id)
);
create index if not exists profile_hidden_form_videos_video_idx on public.profile_hidden_form_videos (video_id);

revoke all on public.profile_hidden_form_videos from anon;
grant select, insert, delete on public.profile_hidden_form_videos to authenticated;
alter table public.profile_hidden_form_videos enable row level security;

drop policy if exists profile_hidden_form_videos_select_own on public.profile_hidden_form_videos;
drop policy if exists profile_hidden_form_videos_insert_own on public.profile_hidden_form_videos;
drop policy if exists profile_hidden_form_videos_delete_own on public.profile_hidden_form_videos;
create policy profile_hidden_form_videos_select_own on public.profile_hidden_form_videos
  for select to authenticated using (public.owns_gym_profile(profile_id));
create policy profile_hidden_form_videos_insert_own on public.profile_hidden_form_videos
  for insert to authenticated with check (public.owns_gym_profile(profile_id));
create policy profile_hidden_form_videos_delete_own on public.profile_hidden_form_videos
  for delete to authenticated using (public.owns_gym_profile(profile_id));

-- ---------------------------------------------------------------------
-- 5. Realtime: new tables stay live across devices (RLS still filters events).
-- ---------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach table_name in array array['account_split_day_backgrounds', 'exercise_form_videos', 'profile_hidden_form_videos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Read-only checks (run separately afterwards):
--   select column_name from information_schema.columns where table_name = 'gym_profiles' and column_name = 'show_photo_on_card';
--   select column_name from information_schema.columns where table_name = 'profile_card_backgrounds' and column_name = 'zoom_percent';
--   select count(*) from public.account_split_day_backgrounds;
--   select count(*) from public.exercise_form_videos;          -- ≤ count of profile_exercise_form_videos (duplicates merged)
--   select count(*) from public.profile_exercise_form_videos;  -- unchanged
--   select count(*) from public.profile_hidden_form_videos;    -- 0
--   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
-- ---------------------------------------------------------------------


-- =====================================================================
-- Phase 8b (identical to supabase/migrations/20261126_phase8b_background_gallery.sql;
-- idempotent, so fresh installs and re-runs are both safe)
-- =====================================================================
do $$
begin
  if to_regclass('public.account_split_day_backgrounds') is null then
    raise exception 'Run the Phase 8 migration (20261125_phase8_shared_videos_split_backgrounds.sql) first.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Gallery table
-- ---------------------------------------------------------------------
create table if not exists public.account_background_images (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Profile that uploaded the image. NULL when that profile was deleted (any profile
  -- of the account may then delete the image); images in use are never removed.
  uploader_profile_id  uuid references public.gym_profiles (id) on delete set null,
  storage_path         text not null unique
                       check (storage_path ~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|splits)/backgrounds/[A-Za-z0-9._-]{1,120}$'),
  created_at           timestamptz not null default now()
);
create index if not exists account_background_images_owner_idx on public.account_background_images (owner_id);
create index if not exists account_background_images_uploader_idx on public.account_background_images (uploader_profile_id);

revoke all on public.account_background_images from anon;
revoke update, delete on public.account_background_images from authenticated;
grant select, insert on public.account_background_images to authenticated;
alter table public.account_background_images enable row level security;

drop policy if exists account_background_images_select_own on public.account_background_images;
drop policy if exists account_background_images_insert_own on public.account_background_images;
create policy account_background_images_select_own on public.account_background_images
  for select to authenticated using (owner_id = (select auth.uid()));
-- New uploads: the uploader must be a profile of this account, and the file must sit
-- in that profile's own backgrounds folder.
create policy account_background_images_insert_own on public.account_background_images
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and uploader_profile_id is not null
    and public.owns_gym_profile(uploader_profile_id)
    and storage_path like ((select auth.uid())::text || '/' || uploader_profile_id::text || '/backgrounds/%')
  );
-- No UPDATE / DELETE policies: rows are immutable and only delete_background_image() removes them.

-- ---------------------------------------------------------------------
-- 2. Backfill: register every image already used by a card or split day.
--    Uploader = the profile whose folder holds the file; for split-folder files the
--    split's creating profile; otherwise the account's oldest profile.
-- ---------------------------------------------------------------------
insert into public.account_background_images (owner_id, uploader_profile_id, storage_path, created_at)
select distinct on (paths.storage_path)
       owner.id,
       coalesce(folder_profile.id, split_profile.id, oldest.id),
       paths.storage_path,
       paths.created_at
  from (
        select storage_path, created_at, null::uuid as split_id from public.profile_card_backgrounds
        union all
        select storage_path, created_at, split_id from public.account_split_day_backgrounds
       ) paths
  join auth.users owner on owner.id::text = split_part(paths.storage_path, '/', 1)
  left join public.gym_profiles folder_profile
         on folder_profile.id::text = split_part(paths.storage_path, '/', 2) and folder_profile.owner_id = owner.id
  left join public.account_workout_split_templates split on split.id = paths.split_id
  left join public.gym_profiles split_profile
         on split_profile.id = split.source_profile_id and split_profile.owner_id = owner.id
  left join lateral (
        select p.id from public.gym_profiles p where p.owner_id = owner.id order by p.created_at, p.id limit 1
       ) oldest on true
 order by paths.storage_path, paths.created_at
on conflict (storage_path) do nothing;

-- ---------------------------------------------------------------------
-- 3. Card / split rows may reference any gallery image of the caller's account.
--    (Profile cards were limited to that profile's own folder before.)
-- ---------------------------------------------------------------------
alter table public.profile_card_backgrounds drop constraint if exists profile_card_backgrounds_storage_path_check;
alter table public.profile_card_backgrounds add constraint profile_card_backgrounds_storage_path_check
  check (storage_path ~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|splits)/backgrounds/[A-Za-z0-9._-]{1,120}$');

-- True when the path is a gallery image of the signed-in account.
create or replace function public.is_own_background_image(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_background_images g
    where g.storage_path = p_path and g.owner_id = auth.uid()
  );
$$;
revoke all on function public.is_own_background_image(text) from public, anon;
grant execute on function public.is_own_background_image(text) to authenticated;

drop policy if exists profile_card_backgrounds_insert_own on public.profile_card_backgrounds;
drop policy if exists profile_card_backgrounds_update_own on public.profile_card_backgrounds;
create policy profile_card_backgrounds_insert_own on public.profile_card_backgrounds
  for insert to authenticated
  with check (public.owns_gym_profile(profile_id) and public.is_own_background_image(storage_path));
create policy profile_card_backgrounds_update_own on public.profile_card_backgrounds
  for update to authenticated
  using (public.owns_gym_profile(profile_id))
  with check (public.owns_gym_profile(profile_id) and public.is_own_background_image(storage_path));

drop policy if exists account_split_day_backgrounds_insert_own on public.account_split_day_backgrounds;
drop policy if exists account_split_day_backgrounds_update_own on public.account_split_day_backgrounds;
create policy account_split_day_backgrounds_insert_own on public.account_split_day_backgrounds
  for insert to authenticated
  with check (
    exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid()))
    and public.is_own_background_image(storage_path)
  );
create policy account_split_day_backgrounds_update_own on public.account_split_day_backgrounds
  for update to authenticated
  using (exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.account_workout_split_templates t where t.id = split_id and t.owner_id = (select auth.uid()))
    and public.is_own_background_image(storage_path)
  );

-- ---------------------------------------------------------------------
-- 4. Reference protection + uploader-only delete
-- ---------------------------------------------------------------------
-- True while a gallery row exists for the path or any card / split day uses it.
create or replace function public.is_protected_background_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.account_background_images where storage_path = p_path)
      or exists (select 1 from public.profile_card_backgrounds where storage_path = p_path)
      or exists (select 1 from public.account_split_day_backgrounds where storage_path = p_path);
$$;
revoke all on function public.is_protected_background_file(text) from public, anon;
grant execute on function public.is_protected_background_file(text) to authenticated;

-- Deletes ONE gallery row on behalf of the acting profile. Returns the storage path,
-- which the app then removes from Storage (allowed only now that nothing protects it).
create or replace function public.delete_background_image(p_image_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  image record;
begin
  select * into image from public.account_background_images where id = p_image_id;
  if image is null or image.owner_id <> auth.uid() then
    raise exception 'Background image not found.' using errcode = 'P0002';
  end if;
  if image.uploader_profile_id is not null then
    if p_profile_id is null or p_profile_id <> image.uploader_profile_id or not public.owns_gym_profile(p_profile_id) then
      raise exception 'Only the profile that uploaded this image can delete it.' using errcode = '42501';
    end if;
  end if;
  if exists (select 1 from public.profile_card_backgrounds where storage_path = image.storage_path)
     or exists (select 1 from public.account_split_day_backgrounds where storage_path = image.storage_path) then
    raise exception 'This image is still used by a card or split. Choose another image there first.' using errcode = '23503';
  end if;
  delete from public.account_background_images where id = p_image_id;
  return image.storage_path;
end;
$$;
revoke all on function public.delete_background_image(uuid, uuid) from public, anon;
grant execute on function public.delete_background_image(uuid, uuid) to authenticated;

-- Storage: same owner-folder rule as before, plus gallery / in-use files can't be
-- deleted or overwritten through the API.
drop policy if exists "gym_photos_update_own" on storage.objects;
drop policy if exists "gym_photos_delete_own" on storage.objects;
create policy "gym_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_protected_background_file(name))
  with check (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gym-profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_protected_background_file(name));

-- ---------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_background_images'
  ) then
    alter publication supabase_realtime add table public.account_background_images;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Read-only checks (run separately afterwards):
--   select count(*) from public.account_background_images;      -- ≥ distinct paths used by cards and split days
--   select count(*) from (select storage_path from public.profile_card_backgrounds union select storage_path from public.account_split_day_backgrounds) used
--     where storage_path not in (select storage_path from public.account_background_images);   -- 0
--   select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'gym_photos%';
--   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
-- ---------------------------------------------------------------------


-- =====================================================================
-- Phase 8c (identical to supabase/migrations/20261127_phase8c_background_delete_cleanup.sql;
-- idempotent, so fresh installs and re-runs are both safe)
-- =====================================================================
do $$
begin
  if to_regclass('public.account_background_images') is null then
    raise exception 'Run the Phase 8b migration (20261126_phase8b_background_gallery.sql) first.';
  end if;
end $$;

create or replace function public.delete_background_image(p_image_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  image record;
begin
  -- Lock the row: a second, concurrent delete of the same image waits, then finds nothing.
  select * into image from public.account_background_images where id = p_image_id for update;
  if image is null or image.owner_id is distinct from auth.uid() then
    raise exception 'Background image not found.' using errcode = 'P0002';
  end if;
  if p_profile_id is not null and not public.owns_gym_profile(p_profile_id) then
    raise exception 'Only the profile that uploaded this image can delete it.' using errcode = '42501';
  end if;
  if image.uploader_profile_id is not null and p_profile_id is distinct from image.uploader_profile_id then
    raise exception 'Only the profile that uploaded this image can delete it.' using errcode = '42501';
  end if;

  -- Every place using the image returns to its default background (this account only).
  delete from public.profile_card_backgrounds b
   using public.gym_profiles p
   where b.storage_path = image.storage_path and p.id = b.profile_id and p.owner_id = image.owner_id;
  delete from public.account_split_day_backgrounds b
   using public.account_workout_split_templates t
   where b.storage_path = image.storage_path and t.id = b.split_id and t.owner_id = image.owner_id;

  delete from public.account_background_images where id = image.id;
  -- The caller removes the Storage file at this path next (now unprotected).
  return image.storage_path;
end;
$$;
revoke all on function public.delete_background_image(uuid, uuid) from public, anon;
grant execute on function public.delete_background_image(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Read-only check (run separately afterwards):
--   select prosrc like '%for update%' as new_version from pg_proc where proname = 'delete_background_image';  -- true
-- ---------------------------------------------------------------------
