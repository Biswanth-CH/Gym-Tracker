/**
 * Storage files whose database rows are already gone but whose file could not be deleted yet
 * (e.g. offline right after deleting a gallery image). Nothing references them any more, so the
 * app never shows them; they are retried later. Kept per user, only for the user's own folder.
 */

const KEY_PREFIX = 'gymtrack-pending-file-deletes:';
const MAX_ENTRIES = 200;

export const pendingFileDeletesKey = (userId: string) => `${KEY_PREFIX}${userId}`;

/** Valid entries only: unique paths inside the user's own `<user id>/` folder. */
export function parsePendingFileDeletes(raw: string | null, userId: string): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((path): path is string => typeof path === 'string' && path.startsWith(`${userId}/`) && path.includes('/backgrounds/')))].slice(0, MAX_ENTRIES);
}

export function readPendingFileDeletes(userId: string): string[] {
  try {
    return parsePendingFileDeletes(window.localStorage.getItem(pendingFileDeletesKey(userId)), userId);
  } catch {
    return [];
  }
}

export function writePendingFileDeletes(userId: string, paths: readonly string[]): void {
  try {
    const clean = parsePendingFileDeletes(JSON.stringify(paths), userId);
    if (clean.length === 0) window.localStorage.removeItem(pendingFileDeletesKey(userId));
    else window.localStorage.setItem(pendingFileDeletesKey(userId), JSON.stringify(clean));
  } catch {
    // Storage blocked: the orphaned private file simply stays until a later cleanup.
  }
}
