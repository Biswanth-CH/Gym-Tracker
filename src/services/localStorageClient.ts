/**
 * Low-level JSON helpers shared by the storage services.
 * UI code never imports this file; it goes through the domain services.
 */

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export type ReadResult =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'ok'; value: unknown };

function getStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    throw new StorageUnavailableError('Your browser is blocking local storage.');
  }
}

export function readJson(key: string): ReadResult {
  let raw: string | null;
  try {
    raw = getStorage().getItem(key);
  } catch {
    throw new StorageUnavailableError('Your browser is blocking local storage, so saved data cannot be loaded.');
  }
  if (raw === null) return { kind: 'missing' };
  try {
    return { kind: 'ok', value: JSON.parse(raw) };
  } catch {
    console.warn(`[GymTrack] Ignoring invalid JSON in "${key}".`);
    return { kind: 'invalid' };
  }
}

/**
 * Writes JSON. If the value currently stored under `key` is unreadable, it is
 * copied to `<key>-corrupt-backup` first, so a save never silently destroys
 * data that might be recoverable by hand.
 */
export function writeJson(key: string, value: unknown): void {
  const storage = getStorage();
  try {
    const existing = storage.getItem(key);
    if (existing !== null) {
      try {
        JSON.parse(existing);
      } catch {
        storage.setItem(`${key}-corrupt-backup`, existing);
      }
    }
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new StorageUnavailableError(
      isQuota
        ? 'Storage is full. Try removing a profile picture or deleting unused profiles.'
        : 'Could not save to local storage. It may be disabled in this browser.',
    );
  }
}

/** Calls `onChange` when another tab writes to `key` (or clears storage). */
export function subscribeToKey(key: string, onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
