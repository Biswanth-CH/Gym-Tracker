import { STORAGE_KEYS } from '../constants/storageKeys';
import type { ExercisePreference, ExercisePreferenceChanges, WeightUnit } from '../types/gym';
import { MAX_WEIGHT } from '../utils/workoutUtils';
import { readJson, subscribeToKey, writeJson } from './localStorageClient';

/**
 * Per-profile, per-exercise preferences (current working weight and unit),
 * stored under `gym-tracker-exercise-preferences`:
 *
 *   { "<profileId>": { "<exerciseId>": { workingWeight, workingWeightUnit, weightUnit, updatedAt } } }
 *
 * The working weight keeps its own unit and is only converted for display, so
 * switching kg/lb back and forth never changes (or drifts) the stored value.
 * Records saved before `workingWeightUnit` existed fall back to `weightUnit`.
 *
 * Changing a preference never touches saved workout logs.
 */

type PreferenceStore = Record<string, Record<string, ExercisePreference>>;

export const DEFAULT_PREFERENCE: ExercisePreference = { workingWeight: null, workingWeightUnit: 'KG', weightUnit: 'KG', updatedAt: null };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parsePreference(value: unknown): ExercisePreference | null {
  if (!isObject(value)) return null;
  const weight = value.workingWeight;
  const weightUnit: WeightUnit = value.weightUnit === 'LB' ? 'LB' : 'KG';
  return {
    workingWeight:
      typeof weight === 'number' && Number.isFinite(weight) && weight >= 0 && weight <= MAX_WEIGHT ? weight : null,
    workingWeightUnit: value.workingWeightUnit === 'LB' || value.workingWeightUnit === 'KG' ? value.workingWeightUnit : weightUnit,
    weightUnit,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  };
}

function readStore(): PreferenceStore {
  const result = readJson(STORAGE_KEYS.exercisePreferences);
  if (result.kind !== 'ok' || !isObject(result.value)) return {};
  const store: PreferenceStore = {};
  for (const [profileId, exercises] of Object.entries(result.value)) {
    if (!isObject(exercises)) continue;
    const clean: Record<string, ExercisePreference> = {};
    for (const [exerciseId, raw] of Object.entries(exercises)) {
      const parsed = parsePreference(raw);
      if (parsed) clean[exerciseId] = parsed;
    }
    store[profileId] = clean;
  }
  return store;
}

export function getExercisePreference(profileId: string, exerciseId: string): ExercisePreference {
  return readStore()[profileId]?.[exerciseId] ?? DEFAULT_PREFERENCE;
}

/** Merges changes; skips the write entirely when nothing actually changed. */
export function updateExercisePreference(
  profileId: string,
  exerciseId: string,
  changes: ExercisePreferenceChanges,
): ExercisePreference {
  const store = readStore();
  const current = store[profileId]?.[exerciseId] ?? DEFAULT_PREFERENCE;
  const nextWeight = changes.workingWeight !== undefined ? changes.workingWeight : current.workingWeight;
  const nextUnit: WeightUnit = changes.weightUnit ?? current.weightUnit;
  const nextWeightUnit: WeightUnit = changes.workingWeightUnit ?? current.workingWeightUnit;
  if (nextWeight !== null && (!Number.isFinite(nextWeight) || nextWeight < 0 || nextWeight > MAX_WEIGHT)) {
    throw new Error(`Working weight must be between 0 and ${MAX_WEIGHT}.`);
  }
  if (
    nextWeight === current.workingWeight &&
    nextWeightUnit === current.workingWeightUnit &&
    nextUnit === current.weightUnit &&
    current.updatedAt !== null
  ) {
    return current;
  }
  const next: ExercisePreference = {
    workingWeight: nextWeight,
    workingWeightUnit: nextWeightUnit,
    weightUnit: nextUnit,
    updatedAt: new Date().toISOString(),
  };
  store[profileId] = { ...(store[profileId] ?? {}), [exerciseId]: next };
  writeJson(STORAGE_KEYS.exercisePreferences, store);
  return next;
}

export function deleteExercisePreferencesForProfile(profileId: string): void {
  const store = readStore();
  if (!(profileId in store)) return;
  delete store[profileId];
  writeJson(STORAGE_KEYS.exercisePreferences, store);
}

export function subscribeToPreferenceChanges(onChange: () => void): () => void {
  return subscribeToKey(STORAGE_KEYS.exercisePreferences, onChange);
}
