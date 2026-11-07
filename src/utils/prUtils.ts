import type { LibraryExercise, PersonalRecord, WeightUnit } from '../types/gym';
import { compareSets, estimateOneRepMax, type RecordSet } from './personalRecords';
import { toKg } from './workoutUtils';

/** A completed set considered against the manual PR. */
export interface PrCandidate {
  weight: number | null;
  unit: WeightUnit;
  reps: number;
}

export function toRecordSet(weight: number | null, unit: WeightUnit, reps: number, exercise: LibraryExercise, date = ''): RecordSet {
  const weightKg = weight === null ? 0 : toKg(weight, unit);
  return {
    date,
    weight,
    weightUnit: unit,
    weightKg,
    repetitions: reps,
    estimatedOneRepMaxKg: exercise.loadType === 'WEIGHTED' && exercise.measure === 'REPS' ? estimateOneRepMax(weightKg, reps) : null,
  };
}

/** Whether a set has the values needed to be compared (weight where the exercise needs one). */
export function isComparable(candidate: PrCandidate, exercise: LibraryExercise): boolean {
  if (!Number.isInteger(candidate.reps) || candidate.reps <= 0) return false;
  if (exercise.loadType === 'WEIGHTED') return candidate.weight !== null && candidate.weight > 0;
  if (exercise.loadType === 'ASSISTED') return candidate.weight !== null;
  return true;
}

/**
 * True when a completed set beats the current PR, using the same ranking as
 * Phase 2 (estimated 1RM for weighted reps; least assistance for assisted
 * machines; added load then reps for bodyweight; reps/time for bands).
 * Weights are compared in kilograms internally.
 */
export function beatsRecord(candidate: PrCandidate, record: PersonalRecord | null, exercise: LibraryExercise): boolean {
  if (!isComparable(candidate, exercise)) return false;
  if (!record) return true;
  const next = toRecordSet(candidate.weight, candidate.unit, candidate.reps, exercise);
  const current = toRecordSet(record.weight, record.unit, record.reps, exercise);
  return compareSets(next, current, exercise) > 0;
}
