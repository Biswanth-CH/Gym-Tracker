import type { CardBackgroundSettings, DayId, SplitDayBackground } from '../types/gym';
import { normalizeBackgroundSettings } from './cardBackground';

/**
 * Weekly card backgrounds of a shared split (Phase 8), edited inside the split editor.
 * The editor works on DRAFTS; nothing is saved until the split is saved.
 *
 * Phase 8b: every image comes from the account's background gallery, so a draft only holds
 * a stored image REFERENCE (path) plus its settings — choosing the same gallery image for
 * several days, splits or profiles never uploads a second copy.
 */

export interface BackgroundImageSource {
  kind: 'stored';
  storagePath: string;
  imageUrl: string | null;
}

export interface DayBackgroundDraft {
  image: BackgroundImageSource;
  settings: CardBackgroundSettings;
}

export type SplitBackgroundDrafts = Partial<Record<DayId, DayBackgroundDraft>>;

export function draftsFromStored(backgrounds: readonly SplitDayBackground[]): SplitBackgroundDrafts {
  const drafts: SplitBackgroundDrafts = {};
  for (const background of backgrounds) {
    drafts[background.dayId] = {
      image: { kind: 'stored', storagePath: background.storagePath, imageUrl: background.imageUrl },
      settings: normalizeBackgroundSettings(background),
    };
  }
  return drafts;
}

export const imageUrlOf = (draft: DayBackgroundDraft | undefined): string | null => draft?.image.imageUrl ?? null;

export interface BackgroundUpsert {
  dayId: DayId;
  image: BackgroundImageSource;
  settings: CardBackgroundSettings;
}

export interface BackgroundChangePlan {
  upserts: BackgroundUpsert[];
  /** Row ids of days whose background was removed. */
  deleteIds: string[];
}

const sameSettings = (a: CardBackgroundSettings, b: CardBackgroundSettings) =>
  a.dimPercent === b.dimPercent && a.blurPx === b.blurPx && a.zoomPercent === b.zoomPercent && a.focalX === b.focalX && a.focalY === b.focalY;

/**
 * What saving the drafts changes for one split. `stored` = that split's current rows (empty for
 * a new / duplicated split, so every draft becomes a new row reusing the same image reference).
 * Images are never deleted here: they stay in the gallery until their uploader deletes them.
 */
export function planBackgroundChanges(stored: readonly SplitDayBackground[], drafts: SplitBackgroundDrafts): BackgroundChangePlan {
  const upserts: BackgroundUpsert[] = [];
  const storedByDay = new Map(stored.map((row) => [row.dayId, row]));
  for (const [dayId, draft] of Object.entries(drafts) as Array<[DayId, DayBackgroundDraft | undefined]>) {
    if (!draft) continue;
    const settings = normalizeBackgroundSettings(draft.settings);
    const current = storedByDay.get(dayId);
    const unchanged = current && draft.image.storagePath === current.storagePath && sameSettings(settings, current);
    if (!unchanged) upserts.push({ dayId, image: draft.image, settings });
  }
  const deleteIds = stored.filter((row) => !drafts[row.dayId]).map((row) => row.id);
  return { upserts, deleteIds };
}
