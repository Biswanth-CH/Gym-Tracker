import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { profileUnlockSession } from '../services/profileUnlockSession';
import { useCloudSlice } from './useCloud';

/** PIN-lock state of the account's profiles plus which were unlocked in this tab session. */
export function useProfileLocks() {
  const lockedProfileIdList = useCloudSlice((snapshot) => snapshot.lockedProfileIds);
  const unlockedProfileIds = useSyncExternalStore(profileUnlockSession.subscribe, profileUnlockSession.getSnapshot);
  const lockedProfileIds = useMemo(() => new Set(lockedProfileIdList), [lockedProfileIdList]);

  /** The profile has a PIN (whether or not it is unlocked right now). */
  const isProfileLocked = useCallback((profileId: string) => lockedProfileIds.has(profileId), [lockedProfileIds]);
  /** The profile has a PIN and has not been unlocked in this session → show the PIN screen. */
  const isProfileLockedNow = useCallback(
    (profileId: string) => lockedProfileIds.has(profileId) && !unlockedProfileIds.has(profileId),
    [lockedProfileIds, unlockedProfileIds],
  );
  return { isProfileLocked, isProfileLockedNow, markProfileUnlocked: profileUnlockSession.markProfileUnlocked };
}
