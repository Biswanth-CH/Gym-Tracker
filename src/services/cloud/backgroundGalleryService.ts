import { PROFILE_PHOTO_BUCKET, getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { BackgroundImage } from '../../types/gym';
import { galleryImagePath } from '../../utils/cardBackground';
import { readPendingFileDeletes, writePendingFileDeletes } from '../../utils/pendingFileDeletes';
import { CloudError, toCloudError } from './cloudErrors';
import { isMissingTableError } from './cardBackgroundService';
import { isStoragePathReferenced } from './imageReferences';
import { removeProfilePhotos, uploadCardBackgroundImage } from './profilePhotoService';
import type { BackgroundImageRow } from './rows';

/**
 * Shared background gallery (Phase 8b/8c, `account_background_images`): every profile of the
 * account can see and use every image (by reference — never re-uploaded). Only the profile that
 * uploaded an image can delete it. Deleting an image that is in use first resets every profile
 * card and split day using it to the default look (Phase 8c) — all inside one database
 * transaction (delete_background_image()) — and only then removes the Storage file. If removing
 * the file fails, it is queued and retried; nothing references it any more, so it is never shown.
 */

const MIGRATION_HINT =
  'The background gallery needs the Phase 8b database update. Run supabase/migrations/20261126_phase8b_background_gallery.sql in Supabase, then try again.';
const CLEANUP_HINT =
  'Deleting images that are in use needs the Phase 8c database update. Run supabase/migrations/20261127_phase8c_background_delete_cleanup.sql in Supabase, then try again.';

/** Only the uploading profile may delete (images of a deleted profile: any profile of the account). */
export function canDeleteBackgroundImage(image: Pick<BackgroundImage, 'uploaderProfileId'>, actingProfileId: string): boolean {
  return image.uploaderProfileId === null || image.uploaderProfileId === actingProfileId;
}

/** Removes one file; true only when Storage confirms it was deleted. */
async function removeFile(path: string): Promise<boolean> {
  try {
    const result = await getSupabase().storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
    return !result.error && Array.isArray(result.data) && result.data.length > 0;
  } catch {
    return false;
  }
}

export interface DeleteBackgroundResult {
  /** False when the database part succeeded but the file is queued for a later retry. */
  fileDeleted: boolean;
}

export const backgroundGalleryService = {
  /** Uploads an already compressed image as `profileId` and adds it to the gallery. */
  async upload(userId: string, profileId: string, blob: Blob): Promise<BackgroundImageRow> {
    const path = galleryImagePath(userId, profileId, blob.type);
    await uploadCardBackgroundImage(path, blob);
    const result = await getSupabase().from('account_background_images').insert({ uploader_profile_id: profileId, storage_path: path }).select('*');
    if (result.error) {
      // Nothing references the new file: remove it again (best effort).
      await removeProfilePhotos([path]).catch(() => undefined);
      throw isMissingTableError(result.error) ? new CloudError(MIGRATION_HINT, 'validation') : toCloudError(result.error, 'Could not add the image to the gallery.');
    }
    const row = (result.data as BackgroundImageRow[])[0];
    cloudStore.applyUpserts('account_background_images', [row]);
    return row;
  },

  /**
   * Deletes a gallery image on behalf of `actingProfileId`, even when cards use it: the database
   * (one transaction) checks the account + uploader, resets every card / split day using the image
   * and removes the gallery row. If that fails nothing changes and the file is kept. Afterwards the
   * Storage file is removed; if that fails it is queued for retry (and never shown again).
   */
  async remove(image: BackgroundImage, actingProfileId: string): Promise<DeleteBackgroundResult> {
    if (!canDeleteBackgroundImage(image, actingProfileId)) {
      throw new CloudError('Only the profile that uploaded this image can delete it.', 'permission');
    }
    const result = await getSupabase().rpc('delete_background_image', { p_image_id: image.id, p_profile_id: actingProfileId });
    if (result.error) {
      const message = result.error.message ?? '';
      if (isMissingTableError(result.error) || /function .*delete_background_image/i.test(message)) throw new CloudError(MIGRATION_HINT, 'validation');
      if (/still used/i.test(message)) throw new CloudError(CLEANUP_HINT, 'validation');
      throw toCloudError(result.error, 'Could not delete the image. Nothing was changed.');
    }
    const path = typeof result.data === 'string' && result.data ? result.data : image.storagePath;
    // The database already reset every card using it: mirror that locally right away.
    cloudStore.applyBackgroundImageDeleted(path);
    const fileDeleted = await removeFile(path);
    const userId = cloudStore.getSnapshot().userId;
    if (!fileDeleted && userId) writePendingFileDeletes(userId, [...readPendingFileDeletes(userId), path]);
    return { fileDeleted };
  },

  /** Retries queued file deletions (files no row references any more). Safe to call any time. */
  async retryPendingFileDeletes(): Promise<void> {
    const userId = cloudStore.getSnapshot().userId;
    if (!userId) return;
    const pending = readPendingFileDeletes(userId);
    if (pending.length === 0) return;
    const remaining: string[] = [];
    for (const path of pending) {
      // Never touch a file that is (again) referenced by anything.
      if (isStoragePathReferenced(path)) continue;
      if (!(await removeFile(path))) remaining.push(path);
    }
    // Entries may have been added meanwhile; keep those too.
    const latest = readPendingFileDeletes(userId).filter((path) => !pending.includes(path));
    writePendingFileDeletes(userId, [...remaining, ...latest]);
  },
};
