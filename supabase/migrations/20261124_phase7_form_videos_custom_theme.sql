-- =====================================================================
-- GymTrack — Phase 7 migration
--   1. gym_profiles.custom_theme_color: optional exact HEX colour (#RRGGBB).
--      NULL = use the preset theme_key (all eight presets stay valid).
--   2. profile_exercise_form_videos: form-reference video links saved per
--      profile and exercise variation (YouTube / Instagram / other).
--   3. profile_card_backgrounds: custom background images (+ dim, blur, focal
--      point) for each profile card and each weekly day card, stored in the
--      existing private gym-profile-photos bucket.
--
-- Run ONCE in Supabase Dashboard → SQL Editor, after the Phase 6 migration.
-- Idempotent and additive: no table is dropped, no existing row is changed,
-- RLS stays on, PIN tables and functions are not touched.
--
-- Note on ids: in GymTrack every library exercise IS a selectable variation
-- (e.g. "T-Bar Row – Wide Grip" and "T-Bar Row – Short Grip" are separate
-- exercise ids). So `exercise_id` is the stable variation id; no second id
-- column is needed.
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
drop policy if exists profile_card_backgrounds_insert_own on public.profile_card_backgrounds;
drop policy if exists profile_card_backgrounds_update_own on public.profile_card_backgrounds;
drop policy if exists profile_card_backgrounds_delete_own on public.profile_card_backgrounds;
create policy profile_card_backgrounds_select_own on public.profile_card_backgrounds
  for select to authenticated using (public.owns_gym_profile(profile_id));
-- A row may only point at a file in the caller's own folder for THAT profile.
create policy profile_card_backgrounds_insert_own on public.profile_card_backgrounds
  for insert to authenticated
  with check (
    public.owns_gym_profile(profile_id)
    and storage_path like ((select auth.uid())::text || '/' || profile_id::text || '/backgrounds/%')
  );
create policy profile_card_backgrounds_update_own on public.profile_card_backgrounds
  for update to authenticated
  using (public.owns_gym_profile(profile_id))
  with check (
    public.owns_gym_profile(profile_id)
    and storage_path like ((select auth.uid())::text || '/' || profile_id::text || '/backgrounds/%')
  );
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
