import type { LibraryExercise, WeightUnit, WorkoutSet } from '../types/gym';
import { generateId } from './profileUtils';

/** 1 kg = 2.20462262185 lb. */
export const LB_PER_KG = 2.20462262185;
export const KG_PER_LB = 1 / LB_PER_KG;
/** Converted weights are kept to 6 decimals: precise, and stable across round trips. */
const WEIGHT_PRECISION = 1e6;
export const MAX_SETS_PER_SESSION = 30;
export const MAX_WEIGHT = 1000;
export const MAX_REPS = 1000;
export const MAX_SECONDS = 3600;

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === 'LB' ? weight / LB_PER_KG : weight;
}

export function fromKg(weightKg: number, unit: WeightUnit): number {
  return unit === 'LB' ? weightKg * LB_PER_KG : weightKg;
}

/**
 * Precise unit conversion (no plate rounding), so the numerical meaning is
 * preserved. Callers should always convert from the ORIGINAL value + unit,
 * never from an already-converted, display-rounded number.
 */
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  return Math.round(fromKg(toKg(weight, from), to) * WEIGHT_PRECISION) / WEIGHT_PRECISION;
}

/** "42.5", "40" — no trailing zeros, max one decimal. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'KG' ? 'kg' : 'lb';
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${formatNumber(weight)} ${unitLabel(unit)}`;
}

export function measureLabel(exercise: LibraryExercise, short = false): string {
  if (exercise.measure === 'SECONDS') return short ? 's' : 'Seconds';
  return short ? 'reps' : 'Reps';
}

export function weightFieldLabel(exercise: LibraryExercise): string | null {
  switch (exercise.loadType) {
    case 'WEIGHTED':
      return 'Weight';
    case 'BODYWEIGHT':
      return 'Added';
    case 'ASSISTED':
      return 'Assist';
    case 'BAND':
      return null;
  }
}

/** Human summary of one set, e.g. "40 kg × 12", "BW × 15", "Assist 30 kg × 8", "45 s". */
export function formatSet(set: Pick<WorkoutSet, 'weight' | 'weightUnit' | 'repetitions'>, exercise: LibraryExercise): string {
  const amount =
    set.repetitions === null ? '—' : exercise.measure === 'SECONDS' ? `${set.repetitions} s` : `${set.repetitions}`;
  const weight = set.weight ?? 0;
  switch (exercise.loadType) {
    case 'WEIGHTED':
      return `${set.weight === null ? '—' : formatWeight(weight, set.weightUnit)} × ${amount}`;
    case 'BODYWEIGHT':
      return weight > 0 ? `BW + ${formatWeight(weight, set.weightUnit)} × ${amount}` : `BW × ${amount}`;
    case 'ASSISTED':
      return `Assist ${formatWeight(weight, set.weightUnit)} × ${amount}`;
    case 'BAND':
      return exercise.measure === 'SECONDS' ? amount : `Band × ${amount}`;
  }
}

export function createEmptySet(setNumber: number, unit: WeightUnit, weight: number | null = null): WorkoutSet {
  return { id: generateId(), setNumber, weight, weightUnit: unit, repetitions: null, completed: false };
}

/** Renumbers sets 1..n after an add/remove. */
export function renumberSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((set, index) => (set.setNumber === index + 1 ? set : { ...set, setNumber: index + 1 }));
}

/**
 * Validates sets before saving. Returns a user-facing message or null.
 * Completed sets need a positive rep/second count and a valid load.
 * Incomplete sets may be left partially blank (planned sets).
 */
export function validateSets(sets: WorkoutSet[], exercise: LibraryExercise): string | null {
  if (sets.length === 0) return 'Add at least one set before saving.';
  if (sets.length > MAX_SETS_PER_SESSION) return `A session can have at most ${MAX_SETS_PER_SESSION} sets.`;
  const maxAmount = exercise.measure === 'SECONDS' ? MAX_SECONDS : MAX_REPS;
  const amountName = exercise.measure === 'SECONDS' ? 'seconds' : 'reps';

  for (const set of sets) {
    const label = `Set ${set.setNumber}`;
    if (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > MAX_WEIGHT)) {
      return `${label}: enter a weight between 0 and ${MAX_WEIGHT}.`;
    }
    if (set.repetitions !== null && (!Number.isInteger(set.repetitions) || set.repetitions < 0 || set.repetitions > maxAmount)) {
      return `${label}: enter whole ${amountName} between 0 and ${maxAmount}.`;
    }
    if (set.completed) {
      if (set.repetitions === null || set.repetitions <= 0) return `${label}: enter the ${amountName} you completed.`;
      if (exercise.loadType === 'WEIGHTED' && set.weight === null) return `${label}: enter the weight you used.`;
      if (exercise.loadType === 'ASSISTED' && set.weight === null) return `${label}: enter the assistance weight.`;
    }
  }
  return null;
}

/** Parses a text field into a number, or null when blank / invalid. */
export function parseNumberInput(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
