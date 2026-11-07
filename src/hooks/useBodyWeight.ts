import { useCallback, useMemo } from 'react';
import { bodyWeightService } from '../services/cloud/bodyWeightService';
import { toBodyWeight } from '../services/cloud/rows';
import type { BodyWeightEntry, DateKey, WeightUnit } from '../types/gym';
import { useCloudSlice } from './useCloud';

export function useBodyWeight(profileId: string) {
  const rows = useCloudSlice((snapshot) => snapshot.bodyWeights);
  const entries: BodyWeightEntry[] = useMemo(
    () =>
      rows
        .filter((row) => row.profile_id === profileId)
        .map(toBodyWeight)
        .filter((entry): entry is BodyWeightEntry => entry !== null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, profileId],
  );

  const byDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const save = useCallback(
    (date: DateKey, weight: number, unit: WeightUnit) => bodyWeightService.save(profileId, date, weight, unit),
    [profileId],
  );
  const remove = useCallback((entryId: string) => bodyWeightService.remove(entryId), []);

  return { entries, byDate, save, remove };
}
