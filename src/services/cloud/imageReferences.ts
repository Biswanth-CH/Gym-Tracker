import { cloudStore } from '../../store/cloudStore';
import { WEEKLY_SCHEDULE } from '../../constants/workoutSchedule';
import { listProfileFiles, removeProfilePhotos } from './profilePhotoService';

/**
 * Background images may be referenced by several rows (profile cards, split days, duplicated
 * splits) and are kept in the account's gallery (Phase 8b) until their uploader deletes them.
 * The in-memory store mirrors every row of the account (RLS), so it can answer "who uses this?".
 * The database enforces the same rules (delete_background_image() + storage policies).
 */

/** Where an image is used, as short human-readable labels ("Bisss · profile card", "Upper Lower · Monday"). */
export function backgroundUsage(path: string): string[] {
  const snapshot = cloudStore.getSnapshot();
  const profileName = (id: string) => snapshot.profiles.find((row) => row.id === id)?.name ?? 'A profile';
  const splitName = (id: string) => snapshot.splitTemplates.find((row) => row.id === id)?.split_name ?? 'A split';
  const dayName = (id: string) => WEEKLY_SCHEDULE.find((day) => day.id === id)?.dayName ?? id;
  return [
    ...snapshot.cardBackgrounds.filter((row) => row.storage_path === path).map((row) => `${profileName(row.profile_id)} · profile card`),
    ...snapshot.splitBackgrounds.filter((row) => row.storage_path === path).map((row) => `${splitName(row.split_id)} · ${dayName(row.day_id)}`),
  ];
}

/** True when a card, a split day, the gallery or an avatar still uses this file. */
export function isStoragePathReferenced(path: string): boolean {
  const snapshot = cloudStore.getSnapshot();
  return (
    backgroundUsage(path).length > 0 ||
    snapshot.backgroundImages.some((row) => row.storage_path === path) ||
    snapshot.profiles.some((row) => row.photo_path === path)
  );
}

/** Deletes the files nobody references. Best effort: a failed cleanup only leaves an unused private file. */
export async function deleteFilesIfUnreferenced(paths: readonly string[]): Promise<void> {
  const unused = [...new Set(paths)].filter((path) => path && !isStoragePathReferenced(path));
  if (unused.length > 0) await removeProfilePhotos(unused).catch(() => undefined);
}

/**
 * After a profile was deleted (and removed from the store): its avatar files are deleted.
 * Its gallery images stay available to the other profiles (the database clears their uploader);
 * only stray background files that nothing references are removed.
 */
export async function removeFilesOfDeletedProfile(userId: string, profileId: string): Promise<void> {
  const { photos, backgrounds } = await listProfileFiles(userId, profileId);
  if (photos.length > 0) await removeProfilePhotos(photos).catch(() => undefined);
  await deleteFilesIfUnreferenced(backgrounds);
}
