-- GymTrack — Phase 4 migration
-- Custom workout splits and daily body weight.
--
-- Run this whole file once in the Supabase Dashboard → SQL Editor
-- on a project that already has supabase/schema.sql applied.
-- It is idempotent: running it again does not delete existing rows.
-- Do not drop existing tables. Do not disable RLS.

create table if not exists public.profile_workout_plans (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.gym_profiles (id) on delete cascade,
  plan_type        text not null default 'PPL' check (plan_type in ('PPL', 'CUSTOM')),
  split_name       text not null default 'My Split' check (char_length(btrim(split_name)) between 1 and 40),
  weekly_schedule  jsonb not null check (jsonb_typeof(weekly_schedule) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.body_weight_entries (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.gym_profiles (id) on delete cascade,
  recorded_date   date not null,
  weight_kg       numeric(6, 3) not null check (weight_kg > 0 and weight_kg <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint body_weight_entries_profile_date_key unique (profile_id, recorded_date)
);

create index if not exists profile_workout_plans_profile_idx on public.profile_workout_plans (profile_id);
create index if not exists body_weight_entries_profile_date_idx on public.body_weight_entries (profile_id, recorded_date);

do $$
declare t text;
begin
  foreach t in array array['profile_workout_plans', 'body_weight_entries']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at',
      t
    );
  end loop;
end $$;

revoke all on public.profile_workout_plans, public.body_weight_entries from anon;
grant select, insert, update, delete on public.profile_workout_plans, public.body_weight_entries to authenticated;

alter table public.profile_workout_plans enable row level security;
alter table public.body_weight_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profile_workout_plans', 'body_weight_entries']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.owns_gym_profile(profile_id))',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.owns_gym_profile(profile_id))',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.owns_gym_profile(profile_id)) with check (public.owns_gym_profile(profile_id))',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.owns_gym_profile(profile_id))',
      t || '_delete_own', t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['profile_workout_plans', 'body_weight_entries']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
