-- =====================================================================
-- GymTrack — Phase 8b migration: shared background gallery
--   1. account_background_images: one row per uploaded background image of an
--      account, with the PROFILE that uploaded it. Every profile of the account
--      can see and use every image; only its uploader can delete it.
--   2. Card / split background rows may point at ANY gallery image of the
--      caller's account (so a profile can use another profile's image by
--      reference — no second upload).
--   3. delete_background_image(): the only way to delete a gallery row. It checks
--      the uploader profile and refuses while any profile card or split day still
--      uses the image.
--   4. Storage: gallery files and files still in use cannot be deleted or
--      overwritten through the API (only after the gallery row is gone and no
--      card / split uses the path).
--
-- Run ONCE in Supabase Dashboard → SQL Editor, AFTER the Phase 8 migration.
-- Idempotent and additive: no table is dropped, no background row or image is
-- changed or deleted. Existing images are registered in the gallery (backfill).
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
