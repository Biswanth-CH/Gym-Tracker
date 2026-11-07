import { PROFILE_NAME_MAX_LENGTH } from '../constants/storageKeys';
type NamedEntity = { id: string; name: string };

/** Trim and collapse internal whitespace. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function getInitials(name: string): string {
  const words = normalizeName(name).split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Returns a user-facing error message, or null when the name is valid.
 * The duplicate check is case-insensitive; `excludeId` lets a profile keep its own name.
 */
export function validateProfileName(
  name: string,
  existingProfiles: readonly NamedEntity[],
  excludeId?: string,
): string | null {
  const normalized = normalizeName(name);
  if (!normalized) return 'Please enter a profile name.';
  if (normalized.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const lower = normalized.toLowerCase();
  const isDuplicate = existingProfiles.some(
    (profile) => profile.id !== excludeId && profile.name.toLowerCase() === lower,
  );
  return isDuplicate ? 'A profile with this name already exists.' : null;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#c6f432', '#5ee6a8'],
  ['#ff8a4c', '#ff4d6d'],
  ['#5b9dff', '#8b6dff'],
  ['#2fd4c4', '#5b9dff'],
  ['#ffcc4d', '#ff8a4c'],
  ['#b06dff', '#ff6dc8'],
];

/** Deterministic avatar gradient so a profile keeps its colour across sessions. */
export function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const [from, to] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
