import { useCallback, useMemo } from 'react';
import { toSplitBackground } from '../services/cloud/rows';
import type { DayId, SplitDayBackground } from '../types/gym';
import { useCloudSlice } from './useCloud';

/** Weekly card backgrounds of the account's shared splits (Phase 8), by split + weekday. */
export function useSplitBackgrounds() {
  const rows = useCloudSlice((snapshot) => snapshot.splitBackgrounds);
  const photoUrls = useCloudSlice((snapshot) => snapshot.photoUrls);
  const bySplit = useMemo(() => {
    const map = new Map<string, SplitDayBackground[]>();
    for (const row of rows) {
      const background = toSplitBackground(row, photoUrls[row.storage_path] ?? null);
      if (!background) continue;
      map.set(background.splitId, [...(map.get(background.splitId) ?? []), background]);
    }
    return map;
  }, [rows, photoUrls]);
  const backgroundsOfSplit = useCallback((splitId: string | null | undefined): SplitDayBackground[] => (splitId ? bySplit.get(splitId) ?? [] : []), [bySplit]);
  const getSplitDayBackground = useCallback(
    (splitId: string | null | undefined, dayId: DayId): SplitDayBackground | null => backgroundsOfSplit(splitId).find((background) => background.dayId === dayId) ?? null,
    [backgroundsOfSplit],
  );
  return { backgroundsOfSplit, getSplitDayBackground };
}
