import { DEFAULT_GENDER, isGender } from '../constants/profileOptions';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { LocalProfile as Profile, LocalProfileInput as ProfileInput, ProfileUpdates } from '../types/gym';
import { generateId, normalizeName, validateProfileName } from '../utils/profileUtils';
import { deleteAttendanceForProfile } from './attendanceStorageService';
import { deleteExercisePreferencesForProfile } from './exerciseStorageService';
import { deleteWorkoutLogsForProfile } from './workoutStorageService';
import { StorageUnavailableError, readJson, subscribeToKey, writeJson } from './localStorageClient';

/**
 * The only module that reads/writes profile data.
 * When a real backend arrives, swap these functions for API calls with the
 * same shapes (they can become async; only useProfiles needs to change).
 */

/** Thrown for problems the user can fix (empty name, duplicate, etc.). */
export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

/** Thrown when the browser refuses to read or write storage. */
export { StorageUnavailableError as ProfileStorageError };

/**
 * Accepts both the current shape and the original v1 shape
 * ({ id, name, createdAt, updatedAt }) and returns a current Profile.
 * IDs and dates are kept exactly as stored. Returns null for unusable entries.
 */
function migrateProfile(value: unknown): Profile | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null;
  }

  const profile: Profile = {
    id: candidate.id,
    name: candidate.name,
    gender: isGender(candidate.gender) ? candidate.gender : DEFAULT_GENDER,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
  if (typeof candidate.photoDataUrl === 'string' && candidate.photoDataUrl.startsWith('data:image/')) {
    profile.photoDataUrl = candidate.photoDataUrl;
  }
  return profile;
}

function writeProfiles(profiles: Profile[]): void {
  writeJson(STORAGE_KEYS.profiles, profiles);
}

export function getProfiles(): Profile[] {
  const result = readJson(STORAGE_KEYS.profiles);
  if (result.kind !== 'ok') return [];
  if (!Array.isArray(result.value)) {
    console.warn(`[GymTrack] Expected an array in "${STORAGE_KEYS.profiles}".`);
    return [];
  }
  return result.value.map(migrateProfile).filter((profile): profile is Profile => profile !== null);
}

function applyPhoto(profile: Profile, photoDataUrl: string | null | undefined): Profile {
  if (photoDataUrl === undefined) return profile;
  const { photoDataUrl: _previous, ...rest } = profile;
  return photoDataUrl ? { ...rest, photoDataUrl } : rest;
}

export function createProfile(input: ProfileInput): Profile {
  const profiles = getProfiles();
  const error = validateProfileName(input.name, profiles);
  if (error) throw new ProfileValidationError(error);

  const now = new Date().toISOString();
  const profile = applyPhoto(
    {
      id: generateId(),
      name: normalizeName(input.name),
      gender: isGender(input.gender) ? input.gender : DEFAULT_GENDER,
      createdAt: now,
      updatedAt: now,
    },
    input.photoDataUrl,
  );
  writeProfiles([...profiles, profile]);
  return profile;
}

export function updateProfile(profileId: string, updates: ProfileUpdates): Profile {
  const profiles = getProfiles();
  const existing = profiles.find((profile) => profile.id === profileId);
  if (!existing) throw new ProfileValidationError('This profile no longer exists.');

  let next: Profile = { ...existing };
  if (updates.name !== undefined) {
    const error = validateProfileName(updates.name, profiles, profileId);
    if (error) throw new ProfileValidationError(error);
    next.name = normalizeName(updates.name);
  }
  if (updates.gender !== undefined && isGender(updates.gender)) {
    next.gender = updates.gender;
  }
  next = applyPhoto(next, updates.photoDataUrl);
  next.updatedAt = new Date().toISOString();

  writeProfiles(profiles.map((profile) => (profile.id === profileId ? next : profile)));
  return next;
}

/** Deletes the profile and everything it owns: attendance, workout logs and exercise preferences. */
export function deleteProfile(profileId: string): void {
  const profiles = getProfiles();
  writeProfiles(profiles.filter((profile) => profile.id !== profileId));
  deleteAttendanceForProfile(profileId);
  deleteWorkoutLogsForProfile(profileId);
  deleteExercisePreferencesForProfile(profileId);
}

/** Notifies the caller when another browser tab changes the stored profiles. */
export function subscribeToProfileChanges(onChange: () => void): () => void {
  return subscribeToKey(STORAGE_KEYS.profiles, onChange);
}
