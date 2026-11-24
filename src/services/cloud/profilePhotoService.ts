import { PROFILE_PHOTO_BUCKET, getSupabase } from '../../lib/supabaseClient';
import { SIGNED_URL_TTL_SECONDS } from '../../utils/signedUrlCache';
import { ensureOk, toCloudError } from './cloudErrors';

/**
 * Profile photos in the PRIVATE `gym-profile-photos` bucket.
 * Paths: `<userId>/<profileId>/<file>`; Storage RLS only allows a user to
 * touch objects under their own `<userId>/` folder.
 */

export { SIGNED_URL_TTL_SECONDS };

/**
 * Every upload gets a NEW path and files are never overwritten in place, so they can be
 * cached for a long time: a changed image always has a different path / URL.
 */
const IMMUTABLE_CACHE_SECONDS = '31536000';

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/webp';
  const bytes = atob(base64 ?? '');
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

const extensionFor = (mime: string) => (mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp');

/** Uploads a (cropped, compressed) avatar. A fixed `fileName` makes retries idempotent. */
export async function uploadProfilePhoto(userId: string, profileId: string, blob: Blob, fileName?: string): Promise<string> {
  const path = `${userId}/${profileId}/${fileName ?? Date.now()}.${extensionFor(blob.type)}`;
  const result = await getSupabase()
    .storage.from(PROFILE_PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: true, cacheControl: IMMUTABLE_CACHE_SECONDS });
  ensureOk(result, 'Could not upload the profile picture.');
  return path;
}

export async function removeProfilePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  ensureOk(await getSupabase().storage.from(PROFILE_PHOTO_BUCKET).remove(paths), 'Could not remove the old profile picture.');
}

/** File paths directly inside a folder (Storage lists are not recursive; folders have no id). */
async function listFiles(folder: string): Promise<string[]> {
  const listed = await getSupabase().storage.from(PROFILE_PHOTO_BUCKET).list(folder, { limit: 1000 });
  const entries = (ensureOk(listed, 'Could not list profile pictures.') ?? []) as Array<{ name: string; id: string | null }>;
  return entries.filter((entry) => entry.id !== null).map((entry) => `${folder}/${entry.name}`);
}

/** Avatar files and background files stored in a profile's folder. */
export async function listProfileFiles(userId: string, profileId: string): Promise<{ photos: string[]; backgrounds: string[] }> {
  const folder = `${userId}/${profileId}`;
  const [photos, backgrounds] = await Promise.all([listFiles(folder), listFiles(`${folder}/backgrounds`)]);
  return { photos, backgrounds };
}

/** Uploads a compressed card background to an exact, new path (never overwrites another file). */
export async function uploadCardBackgroundImage(path: string, blob: Blob): Promise<void> {
  const result = await getSupabase()
    .storage.from(PROFILE_PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: false, cacheControl: IMMUTABLE_CACHE_SECONDS });
  ensureOk(result, 'Could not upload the background image.');
}

/** Short-lived signed URLs (private bucket). Missing / failed paths are simply left out. */
export async function signProfilePhotos(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const result = await getSupabase().storage.from(PROFILE_PHOTO_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
    const data = (ensureOk(result, 'Could not load profile pictures.') ?? []) as Array<{ path: string | null; signedUrl: string | null; error: string | null }>;
    return Object.fromEntries(data.filter((item) => item.path && item.signedUrl && !item.error).map((item) => [item.path as string, item.signedUrl as string]));
  } catch (error) {
    throw toCloudError(error, 'Could not load profile pictures.');
  }
}
