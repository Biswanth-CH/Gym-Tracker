import { useCallback, useMemo } from 'react';
import { toCardBackground } from '../services/cloud/rows';
import type { CardBackground, CardBackgroundKey } from '../types/gym';
import { useCloudSlice } from './useCloud';

/** Every card background of the signed-in account, looked up by profile + card. */
export function useCardBackgrounds() {
  const rows = useCloudSlice((snapshot) => snapshot.cardBackgrounds);
  const photoUrls = useCloudSlice((snapshot) => snapshot.photoUrls);
  const byKey = useMemo(() => {
    const map = new Map<string, CardBackground>();
    for (const row of rows) {
      const background = toCardBackground(row, photoUrls[row.storage_path] ?? null);
      if (background) map.set(`${background.profileId}:${background.cardKey}`, background);
    }
    return map;
  }, [rows, photoUrls]);
  const getCardBackground = useCallback(
    (profileId: string, cardKey: CardBackgroundKey): CardBackground | null => byKey.get(`${profileId}:${cardKey}`) ?? null,
    [byKey],
  );
  return { getCardBackground };
}
