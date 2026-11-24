/**
 * Signed-URL reuse for private images (Phase 8).
 *
 * Profile pictures and card backgrounds live in a PRIVATE bucket and are shown through
 * signed URLs. Every new signature is a new URL, so the browser can't reuse its cached
 * copy. Instead we keep each path's signed URL (and its expiry) per signed-in user and
 * reuse it until it is close to expiring:
 *   - the same URL across page loads → the browser's HTTP cache serves the image;
 *   - files are immutable (every upload gets a new path), so a cached image is never
 *     stale: a replaced image has a new path and therefore a new URL;
 *   - entries expiring within the margin are re-signed before use;
 *   - only paths inside the user's own `<user id>/` folder are kept, entries are stored
 *     per user id, and everything is cleared on sign-out, so another account on the same
 *     device can never pick them up.
 * Pure functions here; cloudStore does the I/O.
 */

export interface SignedUrlEntry {
  url: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export type SignedUrlMap = Record<string, SignedUrlEntry>;

/** Signed URLs live 24 h; they are re-signed when less than 2 h remain. */
export const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
export const SIGNED_URL_RENEW_MARGIN_MS = 2 * 60 * 60 * 1000;

const KEY_PREFIX = 'gymtrack-signed-urls:';

export const signedUrlStorageKey = (userId: string) => `${KEY_PREFIX}${userId}`;

const isOwnPath = (userId: string, path: string) => path.startsWith(`${userId}/`);

/** Valid, unexpired (beyond the margin) entries for this user's own files. */
export function parseSignedUrlMap(raw: string | null, userId: string, now: number, marginMs = SIGNED_URL_RENEW_MARGIN_MS): SignedUrlMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: SignedUrlMap = {};
  for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isOwnPath(userId, path) || typeof value !== 'object' || value === null) continue;
    const { url, expiresAt } = value as { url?: unknown; expiresAt?: unknown };
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || typeof expiresAt !== 'number') continue;
    if (expiresAt - marginMs <= now) continue;
    out[path] = { url, expiresAt };
  }
  return out;
}

/** Paths that have no usable signed URL (missing or expiring within the margin). */
export function pathsNeedingSignature(paths: readonly string[], map: SignedUrlMap, now: number, marginMs = SIGNED_URL_RENEW_MARGIN_MS): string[] {
  return [...new Set(paths.filter(Boolean))].filter((path) => {
    const entry = map[path];
    return !entry || entry.expiresAt - marginMs <= now;
  });
}

/** Keeps only the entries for paths still in use (deleted / replaced images are forgotten). */
export function pruneSignedUrlMap(map: SignedUrlMap, paths: readonly string[]): SignedUrlMap {
  const used = new Set(paths);
  return Object.fromEntries(Object.entries(map).filter(([path]) => used.has(path)));
}

export function readSignedUrlMap(userId: string, now: number): SignedUrlMap {
  try {
    return parseSignedUrlMap(window.localStorage.getItem(signedUrlStorageKey(userId)), userId, now);
  } catch {
    return {};
  }
}

export function writeSignedUrlMap(userId: string, map: SignedUrlMap): void {
  try {
    const own = Object.fromEntries(Object.entries(map).filter(([path]) => isOwnPath(userId, path)));
    window.localStorage.setItem(signedUrlStorageKey(userId), JSON.stringify(own));
  } catch {
    // Storage full / blocked (private mode): images are simply re-signed next time.
  }
}

/** Sign-out: forget every user's signed URLs on this device. */
export function clearSignedUrlMaps(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
