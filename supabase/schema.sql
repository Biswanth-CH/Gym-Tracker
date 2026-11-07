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
