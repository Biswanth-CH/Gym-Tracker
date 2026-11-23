import { cloudStore } from '../../store/cloudStore';
import { getSupabase } from '../../lib/supabaseClient';
import type { CardBackground, CardBackgroundKey, CardBackgroundSettings } from '../../types/gym';
import { cardBackgroundPath, normalizeBackgroundSettings } from '../../utils/cardBackground';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import { removeProfilePhotos, uploadCardBackgroundImage } from './profilePhotoService';
import type { CardBackgroundRow } from './rows';

/**
 * Card backgrounds (Phase 7): images in the existing PRIVATE `gym-profile-photos` bucket under
 * `<user>/<profile>/backgrounds/`, settings in `profile_card_backgrounds` (one row per profile
 * + card). Storage RLS limits files to the owner's folder; table RLS requires the path to be in
 * that profile's own backgrounds folder. Replaced / removed files are deleted only when no
 * other card still references them.
 */

const MIGRATION_HINT =
  'Card backgrounds need the Phase 7 database update. Run supabase/migrations/20261124_phase7_form_videos_custom_theme.sql in Supabase, then try again.';

function isMissingTableError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST205' || code === '42P01' || /could not find the table|schema cache/i.test(message);
}

/** True when another card (or an avatar) still uses this file. */
export function isStoragePathReferenced(path: string, exceptBackgroundId?: string): boolean {
  const snapshot = cloudStore.getSnapshot();
  return (
    snapshot.cardBackgrounds.some((row) => row.storage_path === path && row.id !== exceptBackgroundId) ||
    snapshot.profiles.some((row) => row.photo_path === path)
  );
}

async function deleteFileIfUnreferenced(path: string): Promise<void> {
  if (isStoragePathReferenced(path)) return;
  // Best effort: the card already shows the new state; a failed cleanup only leaves an unused private file.
  await removeProfilePhotos([path]).catch(() => undefined);
}

export interface SaveCardBackgroundInput {
  userId: string;
  profileId: string;
  cardKey: CardBackgroundKey;
  /** A newly chosen (already compressed) image, or null to keep the current one. */
  newImage: Blob | null;
  settings: CardBackgroundSettings;
  existing: CardBackground | null;
}

export const cardBackgroundService = {
  async save({ userId, profileId, cardKey, newImage, settings, existing }: SaveCardBackgroundInput): Promise<void> {
    if (!newImage && !existing) throw new CloudError('Choose an image first.', 'validation');
    const values = normalizeBackgroundSettings(settings);
    let uploadedPath: string | null = null;
    if (newImage) {
      uploadedPath = cardBackgroundPath(userId, profileId, cardKey, newImage.type);
      await uploadCardBackgroundImage(uploadedPath, newImage);
    }
    const storagePath = uploadedPath ?? (existing as CardBackground).storagePath;
    const result = await getSupabase()
      .from('profile_card_backgrounds')
      .upsert(
        {
          profile_id: profileId,
          card_key: cardKey,
          storage_path: storagePath,
          dim_percent: values.dimPercent,
          blur_px: values.blurPx,
          focal_x: values.focalX,
          focal_y: values.focalY,
        },
        { onConflict: 'profile_id,card_key' },
      )
      .select('*');
    if (result.error) {
      if (uploadedPath) await removeProfilePhotos([uploadedPath]).catch(() => undefined);
      throw isMissingTableError(result.error) ? new CloudError(MIGRATION_HINT, 'validation') : toCloudError(result.error, 'Could not save the card background.');
    }
    cloudStore.applyUpserts('profile_card_backgrounds', result.data as CardBackgroundRow[]);
    if (uploadedPath && existing && existing.storagePath !== uploadedPath) await deleteFileIfUnreferenced(existing.storagePath);
  },

  /** Removes the background (the card returns to its normal design) and deletes the file if unused. */
  async remove(background: CardBackground): Promise<void> {
    ensureOk(await getSupabase().from('profile_card_backgrounds').delete().eq('id', background.id), 'Could not remove the card background.');
    cloudStore.applyDeletes('profile_card_backgrounds', (row) => row.id === background.id);
    await deleteFileIfUnreferenced(background.storagePath);
  },
};
