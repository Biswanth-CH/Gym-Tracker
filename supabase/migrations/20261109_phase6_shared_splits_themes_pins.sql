-- =====================================================================
-- GymTrack — Phase 6 migration
--   1. Per-profile colour theme (gym_profiles.theme_key, default 'lime').
--   2. Account-wide shared workout split library (account_workout_split_templates)
--      + a per-profile active reference (profile_workout_plans.active_account_split_id).
--      Every existing custom split is copied in (IDs preserved where possible).
--   3. Optional 4-digit profile PIN lock: bcrypt hashes in profile_pin_security,
--      reachable ONLY through SECURITY DEFINER functions (server-side rate limit).
--
-- Run ONCE in Supabase Dashboard → SQL Editor, after schema.sql (Phase 3) and the
-- Phase 4 migration. The Phase 5 migration is optional: if it was applied, its saved
-- splits are copied with their ids; if not, each profile's legacy custom split is copied.
--
-- Idempotent and additive: no table is dropped, no row is deleted, RLS stays on.
-- Legacy tables/columns (profile_workout_split_templates, split_name,
-- weekly_schedule, active_split_template_id) are kept untouched.
-- A copy log makes re-runs safe: a shared split the user deleted later is NOT
-- re-created by running this file again.
-- Nested region / exercise selections live inside weekly_schedule (JSON); missing
-- selection fields mean "ALL", so no data conversion is needed for them.
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
