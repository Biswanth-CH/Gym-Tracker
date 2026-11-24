-- =====================================================================
-- GymTrack — Phase 8 migration
--   1. gym_profiles.show_photo_on_card: hide the picture on the Profiles page
--      card only (the photo itself is kept and still used everywhere else).
--   2. Zoom (zoom_percent, 100–300 %) for every card background.
--   3. account_split_day_backgrounds: weekly day-card backgrounds now belong to
--      the SHARED SPLIT (split + weekday), so every profile using a split sees
--      the same backgrounds. Existing per-profile day backgrounds are copied to
--      that profile's active / remembered custom split (same image file, no
--      new upload).
--   4. exercise_form_videos: form videos are now SHARED by every signed-in
--      account, per exercise variation. Existing profile videos are copied in
--      (one copy per variation + URL). profile_hidden_form_videos stores the
--      private, per-profile "Hide" choice.
--
-- Run ONCE in Supabase Dashboard → SQL Editor, AFTER the Phase 7 migration.
-- Idempotent and additive: no table or column is dropped, no existing row is
-- changed or deleted, RLS stays on everywhere, PIN tables are not touched.
-- The Phase 7 tables (profile_exercise_form_videos, the weekday rows of
-- profile_card_backgrounds) are kept as they are; the app stops reading them.
-- A copy log makes re-runs safe: a copied video or background the user later
-- deleted is NOT re-created by running this file again.
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
