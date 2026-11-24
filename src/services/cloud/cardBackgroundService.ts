import { cloudStore } from '../../store/cloudStore';
import { getSupabase } from '../../lib/supabaseClient';
import type { CardBackground, CardBackgroundKey, CardBackgroundSettings } from '../../types/gym';
import { normalizeBackgroundSettings } from '../../utils/cardBackground';
import { CloudError, ensureOk, isMissingColumnError, toCloudError } from './cloudErrors';
import type { CardBackgroundRow } from './rows';

/**
 * Profile-card backgrounds: settings in `profile_card_backgrounds` (card_key 'profile'); the image
 * is a reference to the account's background gallery (Phase 8b, any profile's upload). Replacing
 * or removing a background never deletes the image — only its uploader can, from the gallery.
 * Weekday backgrounds moved to the shared split in Phase 8 (splitBackgroundService).
 */

const MIGRATION_HINT =
  'Card backgrounds need the Phase 7 database update. Run supabase/migrations/20261124_phase7_form_videos_custom_theme.sql in Supabase, then try again.';
const ZOOM_MIGRATION_HINT =
  'Background zoom needs the Phase 8 database update. Run supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql in Supabase, then try again.';

export function isMissingTableError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST205' || code === '42P01' || /could not find the table|schema cache/i.test(message);
}

export interface SaveCardBackgroundInput {
  profileId: string;
  cardKey: CardBackgroundKey;
  /** A gallery image path (Phase 8b): chosen images are used by reference, never re-uploaded. */
  storagePath: string;
  settings: CardBackgroundSettings;
  existing: CardBackground | null;
}

export const cardBackgroundService = {
  async save({ profileId, cardKey, storagePath, settings, existing }: SaveCardBackgroundInput): Promise<void> {
    if (!storagePath) throw new CloudError('Choose an image first.', 'validation');
    const values = normalizeBackgroundSettings(settings);
    const row: Record<string, unknown> = {
      profile_id: profileId,
      card_key: cardKey,
      storage_path: storagePath,
      dim_percent: values.dimPercent,
      blur_px: values.blurPx,
      focal_x: values.focalX,
      focal_y: values.focalY,
    };
    // zoom_percent exists after the Phase 8 migration; it is only sent when it is not the default.
    if (values.zoomPercent !== 100 || (existing && existing.zoomPercent !== 100)) row.zoom_percent = values.zoomPercent;
    const result = await getSupabase().from('profile_card_backgrounds').upsert(row, { onConflict: 'profile_id,card_key' }).select('*');
    if (result.error) {
      if (isMissingTableError(result.error)) throw new CloudError(MIGRATION_HINT, 'validation');
      if (isMissingColumnError(result.error)) throw new CloudError(ZOOM_MIGRATION_HINT, 'validation');
      throw toCloudError(result.error, 'Could not save the card background.');
    }
    cloudStore.applyUpserts('profile_card_backgrounds', result.data as CardBackgroundRow[]);
  },

  /** Removes the background from the card (the card returns to its normal design). The image stays in the gallery. */
  async remove(background: CardBackground): Promise<void> {
    ensureOk(await getSupabase().from('profile_card_backgrounds').delete().eq('id', background.id), 'Could not remove the card background.');
    cloudStore.applyDeletes('profile_card_backgrounds', (row) => row.id === background.id);
  },
};
