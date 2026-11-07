import type { Gender } from '../types/gym';

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

/** Applied to profiles created before gender existed, and to unknown values. */
export const DEFAULT_GENDER: Gender = 'PREFER_NOT_TO_SAY';

const GENDER_VALUES = new Set<string>(GENDER_OPTIONS.map((option) => option.value));

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && GENDER_VALUES.has(value);
}

export function getGenderLabel(gender: Gender): string {
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? 'Prefer not to say';
}

/* ---------- Profile pictures ---------- */

/** Output avatar is a square of this many pixels. */
export const AVATAR_SIZE_PX = 256;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

/** Reject very large originals before decoding them (phones can produce 10+ MB photos). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Upper bound for the compressed avatar stored in LocalStorage (~ characters of the data URL). */
export const MAX_AVATAR_DATA_URL_LENGTH = 150_000;
