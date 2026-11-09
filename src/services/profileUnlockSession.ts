/**
 * Which PIN-locked profiles were unlocked in THIS browser tab session.
 * Only profile ids are kept (sessionStorage, so a reload of the same tab stays unlocked,
 * while a new tab / browser session asks again). No PIN or hash is ever stored.
 * Cleared on logout.
 */
const UNLOCKED_PROFILES_KEY = 'gymtrack-unlocked-profiles';
const listeners = new Set<() => void>();
let unlockedProfileIds: ReadonlySet<string> = readStored();

function readStored(): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(UNLOCKED_PROFILES_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persist(next: ReadonlySet<string>): void {
  unlockedProfileIds = next;
  try {
    if (next.size === 0) window.sessionStorage.removeItem(UNLOCKED_PROFILES_KEY);
    else window.sessionStorage.setItem(UNLOCKED_PROFILES_KEY, JSON.stringify([...next]));
  } catch {
    // Storage blocked: the in-memory set still works for this page.
  }
  listeners.forEach((listener) => listener());
}

export const profileUnlockSession = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): ReadonlySet<string> {
    return unlockedProfileIds;
  },
  markProfileUnlocked(profileId: string): void {
    if (!unlockedProfileIds.has(profileId)) persist(new Set([...unlockedProfileIds, profileId]));
  },
  clearUnlockedProfiles(): void {
    persist(new Set());
  },
};
