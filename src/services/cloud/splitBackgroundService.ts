import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { SplitDayBackground } from '../../types/gym';
import { planBackgroundChanges, type SplitBackgroundDrafts } from '../../utils/splitBackgrounds';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import { isMissingTableError } from './cardBackgroundService';
import { toSplitBackground, type SplitBackgroundRow } from './rows';

/**
 * Weekly day-card backgrounds of a SHARED split (`account_split_day_backgrounds`, Phase 8):
 * every profile using the split sees the same backgrounds. Images are references to the account's
 * background gallery (Phase 8b): choosing or duplicating never uploads a second copy, and saving or
 * deleting a split never deletes an image (only its uploader can, from the gallery).
 */

const MIGRATION_HINT =
  'Split backgrounds need the Phase 8 database update. Run supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql in Supabase, then try again.';

function writeError(error: unknown, fallback: string): CloudError {
  return isMissingTableError(error) ? new CloudError(MIGRATION_HINT, 'validation') : toCloudError(error, fallback);
}

/** Stored backgrounds of one split (from the in-memory mirror). */
export function storedSplitBackgrounds(splitId: string): SplitDayBackground[] {
  const snapshot = cloudStore.getSnapshot();
  return snapshot.splitBackgrounds
    .filter((row) => row.split_id === splitId)
    .map((row) => toSplitBackground(row, snapshot.photoUrls[row.storage_path] ?? null))
    .filter((background): background is SplitDayBackground => background !== null);
}

export const splitBackgroundService = {
  /**
   * Saves the split editor's background drafts for `splitId`: uploads each NEW image once,
   * upserts changed days, deletes removed days, then deletes files nothing uses any more.
   */
  async saveDrafts(splitId: string, drafts: SplitBackgroundDrafts): Promise<void> {
    const plan = planBackgroundChanges(storedSplitBackgrounds(splitId), drafts);
    if (plan.upserts.length > 0) {
      const rows = plan.upserts.map(({ dayId, image, settings }) => ({
        split_id: splitId,
        day_id: dayId,
        storage_path: image.storagePath,
        dim_percent: settings.dimPercent,
        blur_px: settings.blurPx,
        zoom_percent: settings.zoomPercent,
        focal_x: settings.focalX,
        focal_y: settings.focalY,
      }));
      const result = await getSupabase().from('account_split_day_backgrounds').upsert(rows, { onConflict: 'split_id,day_id' }).select('*');
      if (result.error) throw writeError(result.error, 'Could not save the split backgrounds.');
      cloudStore.applyUpserts('account_split_day_backgrounds', result.data as SplitBackgroundRow[]);
    }
    if (plan.deleteIds.length > 0) {
      const result = await getSupabase().from('account_split_day_backgrounds').delete().in('id', plan.deleteIds);
      if (result.error) throw writeError(result.error, 'Could not remove a split background.');
      cloudStore.applyDeletes('account_split_day_backgrounds', (row) => plan.deleteIds.includes(row.id));
    }
  },

  /** Copies every background of one split to another (Duplicate): same files, independent rows. */
  async copyAll(sourceSplitId: string, targetSplitId: string): Promise<void> {
    const rows = cloudStore
      .getSnapshot()
      .splitBackgrounds.filter((row) => row.split_id === sourceSplitId)
      .map(({ day_id, storage_path, dim_percent, blur_px, zoom_percent, focal_x, focal_y }) => ({
        split_id: targetSplitId,
        day_id,
        storage_path,
        dim_percent,
        blur_px,
        zoom_percent,
        focal_x,
        focal_y,
      }));
    if (rows.length === 0) return;
    const result = await getSupabase().from('account_split_day_backgrounds').upsert(rows, { onConflict: 'split_id,day_id' }).select('*');
    cloudStore.applyUpserts('account_split_day_backgrounds', ensureOk(result, 'Could not copy the split backgrounds.') as SplitBackgroundRow[]);
  },

  /** After a split was deleted (rows cascade in the database): forget them locally. Images stay in the gallery. */
  cleanUpDeletedSplit(splitId: string): void {
    cloudStore.applyDeletes('account_split_day_backgrounds', (row) => row.split_id === splitId);
  },
};
