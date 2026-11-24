-- =====================================================================
-- GymTrack — Phase 8c migration: deleting a gallery image that is in use
--
-- Phase 8b refused to delete a background image while a profile card or split
-- day used it. Now the uploader may delete it anyway: in ONE transaction the
-- function removes every card / split-day background that uses the image (those
-- cards return to their default look), then the gallery row. The app deletes
-- the Storage file afterwards — Storage only allows that once nothing references
-- the file (Phase 8b policies, unchanged).
--
-- Authorization (unchanged model, enforced here, not only in the app):
--   * the image must belong to the signed-in account (auth.uid());
--   * the acting profile must belong to that account (owns_gym_profile);
--   * the acting profile must be the uploader (images of a deleted profile:
--     any profile of the account).
--   Profiles share one Supabase sign-in, so "acting profile" is the app's claim
--   within the account: other ACCOUNTS can never delete, but a hand-made request
--   from the same account can name the uploading profile. See SUPABASE_SETUP §8h.
--
-- Run ONCE in Supabase Dashboard → SQL Editor, AFTER the Phase 8b migration.
-- Only replaces one function; no table, policy or data changes. Safe to re-run.
-- (Re-running the 8b file afterwards would restore the old refuse-while-in-use
-- function; just run this file again in that case.)
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
