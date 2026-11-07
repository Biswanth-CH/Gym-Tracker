import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { DateKey, WeightUnit } from '../../types/gym';
import { isValidDateKey, toDateKey } from '../../utils/dateUtils';
import { convertWeight } from '../../utils/workoutUtils';
import { CloudError, ensureOk } from './cloudErrors';
import { upsertRow } from './db';
import type { BodyWeightRow } from './rows';

export const MAX_BODY_WEIGHT_KG = 500;

export function canonicalWeightKg(weight: number, unit: WeightUnit): number {
  const kg = convertWeight(weight, unit, 'KG');
  return Math.round(kg * 1000) / 1000;
}

export function validateBodyWeight(date: DateKey, weight: number | null, unit: WeightUnit): string | null {
  if (!isValidDateKey(date)) return 'Choose a valid date.';
  if (date > toDateKey(new Date())) return 'Body weight can’t be logged for a future date.';
  if (weight === null || !Number.isFinite(weight) || weight <= 0) return 'Enter a weight greater than zero.';
  const kg = canonicalWeightKg(weight, unit);
  if (kg <= 0 || kg > MAX_BODY_WEIGHT_KG) return `Weight must be between 0 and ${MAX_BODY_WEIGHT_KG} kg.`;
  return null;
}

export const bodyWeightService = {
  /** Inserts or updates the single entry for this profile and date. Other dates are untouched. */
  async save(profileId: string, date: DateKey, weight: number, unit: WeightUnit): Promise<void> {
    const problem = validateBodyWeight(date, weight, unit);
    if (problem) throw new CloudError(problem, 'validation');
    const row = await upsertRow<BodyWeightRow>(
      'body_weight_entries',
      { profile_id: profileId, recorded_date: date, weight_kg: canonicalWeightKg(weight, unit) },
      'profile_id,recorded_date',
      'Could not save body weight.',
    );
    cloudStore.applyUpserts('body_weight_entries', [row]);
  },

  async remove(entryId: string): Promise<void> {
    ensureOk(await getSupabase().from('body_weight_entries').delete().eq('id', entryId), 'Could not delete the body-weight entry.');
    cloudStore.applyDeletes('body_weight_entries', (row) => row.id === entryId);
  },
};
