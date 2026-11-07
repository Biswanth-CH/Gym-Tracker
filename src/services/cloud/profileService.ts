import { isGender } from '../../constants/profileOptions';
import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { Profile, ProfileInput } from '../../types/gym';
import { isValidDateKey, toDateKey } from '../../utils/dateUtils';
import { normalizeName, validateProfileName } from '../../utils/profileUtils';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import { dataUrlToBlob, removeAllPhotosForProfile, removeProfilePhotos, uploadProfilePhoto } from './profilePhotoService';
import type { ProfileRow } from './rows';

/** Profiles owned by the signed-in account (`gym_profiles`). */

function validateInput(input: ProfileInput, existing: readonly Profile[], excludeId?: string): void {
  const nameError = validateProfileName(input.name, existing, excludeId);
  if (nameError) throw new CloudError(nameError, 'validation');
  if (!isGender(input.gender)) throw new CloudError('Please choose a valid gender option.', 'validation');
  if (!isValidDateKey(input.trackingStartDate)) throw new CloudError('Please choose a valid tracking start date.', 'validation');
  if (input.trackingStartDate > toDateKey(new Date())) throw new CloudError('The tracking start date can’t be in the future.', 'validation');
}

function duplicateNameGuard(error: unknown): never {
  const cloudError = toCloudError(error, 'Could not save the profile.');
  if (cloudError.kind === 'conflict') throw new CloudError('A profile with this name already exists.', 'conflict');
  throw cloudError;
}

export async function createProfile(userId: string, input: ProfileInput, existing: readonly Profile[]): Promise<ProfileRow> {
  validateInput(input, existing);
  const supabase = getSupabase();
  const result = await supabase
    .from('gym_profiles')
    .insert({ owner_id: userId, name: normalizeName(input.name), gender: input.gender, tracking_start_date: input.trackingStartDate })
    .select('*');
  if (result.error) duplicateNameGuard(result.error);
  let row = (result.data as ProfileRow[])[0];
  cloudStore.applyUpserts('gym_profiles', [row]);

  if (input.photo.kind === 'replace') {
    try {
      const path = await uploadProfilePhoto(userId, row.id, dataUrlToBlob(input.photo.dataUrl));
      row = (ensureOk(await supabase.from('gym_profiles').update({ photo_path: path }).eq('id', row.id).select('*'), 'Could not save the profile picture.') as ProfileRow[])[0];
      cloudStore.applyUpserts('gym_profiles', [row]);
    } catch (error) {
      throw new CloudError(`Profile created, but the picture could not be uploaded: ${toCloudError(error).message}`, 'unknown');
    }
  }
  return row;
}

export async function updateProfile(userId: string, profile: Profile, input: ProfileInput, existing: readonly Profile[]): Promise<ProfileRow> {
  validateInput(input, existing, profile.id);
  const supabase = getSupabase();
  const changes: Record<string, unknown> = {
    name: normalizeName(input.name),
    gender: input.gender,
    tracking_start_date: input.trackingStartDate,
  };

  let uploadedPath: string | null = null;
  if (input.photo.kind === 'replace') {
    uploadedPath = await uploadProfilePhoto(userId, profile.id, dataUrlToBlob(input.photo.dataUrl));
    changes.photo_path = uploadedPath;
  } else if (input.photo.kind === 'remove') {
    changes.photo_path = null;
  }

  const result = await supabase.from('gym_profiles').update(changes).eq('id', profile.id).select('*');
  if (result.error) {
    if (uploadedPath) await removeProfilePhotos([uploadedPath]).catch(() => undefined);
    duplicateNameGuard(result.error);
  }
  const row = (result.data as ProfileRow[])[0];
  if (!row) throw new CloudError('This profile no longer exists.', 'unknown');
  cloudStore.applyUpserts('gym_profiles', [row]);

  // Remove the replaced / removed file only after the row points elsewhere.
  if (input.photo.kind !== 'keep' && profile.photoPath && profile.photoPath !== row.photo_path) {
    await removeProfilePhotos([profile.photoPath]).catch(() => undefined);
  }
  return row;
}

/** Deletes the profile; the database cascades attendance, selections, set plans, tracker state and PRs. */
export async function deleteProfile(userId: string, profileId: string): Promise<void> {
  ensureOk(await getSupabase().from('gym_profiles').delete().eq('id', profileId), 'Could not delete the profile.');
  cloudStore.applyProfileDeleted(profileId);
  await removeAllPhotosForProfile(userId, profileId).catch(() => undefined);
}
