import { STORAGE_KEYS } from '../constants/storageKeys';
import type { Profile, ProfileUpdates } from '../types/gym';
import { generateId, normalizeName, validateProfileName } from '../utils/profileUtils';

/**
 * The ONLY module in the app that touches localStorage.
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
export class ProfileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileStorageError';
  }
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.profiles);
  } catch {
    throw new ProfileStorageError(
      'Your browser is blocking local storage, so profiles cannot be loaded.',
    );
  }
}

function writeProfiles(profiles: Profile[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(profiles));
  } catch {
    throw new ProfileStorageError('Could not save to local storage. It may be full or disabled.');
  }
}

export function getProfiles(): Profile[] {
  const raw = readRaw();
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[GymTrack] Ignoring invalid JSON in "${STORAGE_KEYS.profiles}".`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn(`[GymTrack] Expected an array in "${STORAGE_KEYS.profiles}".`);
    return [];
  }

  return parsed.filter(isProfile);
}

export function createProfile(name: string): Profile {
  const profiles = getProfiles();
  const error = validateProfileName(name, profiles);
  if (error) throw new ProfileValidationError(error);

  const now = new Date().toISOString();
  const profile: Profile = {
    id: generateId(),
    name: normalizeName(name),
    createdAt: now,
    updatedAt: now,
  };
  writeProfiles([...profiles, profile]);
  return profile;
}

export function updateProfile(profileId: string, updates: ProfileUpdates): Profile {
  const profiles = getProfiles();
  const existing = profiles.find((profile) => profile.id === profileId);
  if (!existing) throw new ProfileValidationError('This profile no longer exists.');

  let nextName = existing.name;
  if (updates.name !== undefined) {
    const error = validateProfileName(updates.name, profiles, profileId);
    if (error) throw new ProfileValidationError(error);
    nextName = normalizeName(updates.name);
  }

  const updated: Profile = { ...existing, name: nextName, updatedAt: new Date().toISOString() };
  writeProfiles(profiles.map((profile) => (profile.id === profileId ? updated : profile)));
  return updated;
}

export function deleteProfile(profileId: string): void {
  const profiles = getProfiles();
  writeProfiles(profiles.filter((profile) => profile.id !== profileId));
}

/** Notifies the caller when another browser tab changes the stored profiles. */
export function subscribeToProfileChanges(onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEYS.profiles) onChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
