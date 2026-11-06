import type { DateKey, LibraryExercise, WeightUnit, WorkoutExerciseLog } from '../types/gym';
import { toKg } from './workoutUtils';

/**
 * Personal records are DERIVED from the saved workout logs every time —
 * never stored — so editing or deleting an old session always recalculates
 * them correctly.
 *
 * Only COMPLETED sets count. Weights are compared in kilograms, so sessions
 * logged in kg and lb are comparable.
 *
 * "Best set" ranking depends on the exercise's load type:
 *  - WEIGHTED + reps: highest Epley estimated 1RM — so 80 kg × 10 beats
 *    90 kg × 2 (est. 106.7 vs 96 kg), avoiding a naive weight-only comparison.
 *  - BODYWEIGHT: most added weight, then most reps.
 *  - ASSISTED: least assistance (harder), then most reps.
 *  - BAND / timed exercises: most reps / longest time.
 */

export interface RecordSet {
  date: DateKey;
  weight: number | null;
  weightUnit: WeightUnit;
  weightKg: number;
  repetitions: number;
  /** Epley estimate (WEIGHTED + REPS only). */
  estimatedOneRepMaxKg: number | null;
}

export interface PersonalRecords {
  bestSet: RecordSet | null;
  heaviestSet: RecordSet | null;
  bestEstimatedOneRepMax: RecordSet | null;
  mostReps: RecordSet | null;
  completedSessions: number;
  /** Dates of sessions that beat every earlier session's best set when they were logged. */
  prSessionDates: ReadonlySet<DateKey>;
}

/** Epley: weight × (1 + reps / 30). One rep returns the weight itself. An estimate, not a tested max. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

const EPSILON = 1e-9;

/** Positive when `a` is a better set than `b` for this exercise. */
export function compareSets(a: RecordSet, b: RecordSet, exercise: LibraryExercise): number {
  const diff = (x: number, y: number) => (Math.abs(x - y) < EPSILON ? 0 : x - y);
  switch (exercise.loadType) {
    case 'WEIGHTED':
      if (exercise.measure === 'REPS') {
        return diff(a.estimatedOneRepMaxKg ?? 0, b.estimatedOneRepMaxKg ?? 0) || diff(a.weightKg, b.weightKg) || a.repetitions - b.repetitions;
      }
      return diff(a.weightKg, b.weightKg) || a.repetitions - b.repetitions;
    case 'BODYWEIGHT':
      return diff(a.weightKg, b.weightKg) || a.repetitions - b.repetitions;
    case 'ASSISTED':
      return diff(b.weightKg, a.weightKg) || a.repetitions - b.repetitions;
    case 'BAND':
      return a.repetitions - b.repetitions;
  }
}

function completedSetsOf(log: WorkoutExerciseLog, exercise: LibraryExercise): RecordSet[] {
  return log.sets
    .filter((set) => set.completed && set.repetitions !== null && set.repetitions > 0)
    .map((set) => {
      const weightKg = set.weight === null ? 0 : toKg(set.weight, set.weightUnit);
      return {
        date: log.date,
        weight: set.weight,
        weightUnit: set.weightUnit,
        weightKg,
        repetitions: set.repetitions as number,
        estimatedOneRepMaxKg:
          exercise.loadType === 'WEIGHTED' && exercise.measure === 'REPS'
            ? estimateOneRepMax(weightKg, set.repetitions as number)
            : null,
      };
    });
}

function best<T>(items: T[], isBetter: (a: T, b: T) => boolean): T | null {
  return items.reduce<T | null>((current, item) => (current === null || isBetter(item, current) ? item : current), null);
}

export function computePersonalRecords(logs: readonly WorkoutExerciseLog[], exercise: LibraryExercise): PersonalRecords {
  const chronological = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const prSessionDates = new Set<DateKey>();
  const allSets: RecordSet[] = [];
  let runningBest: RecordSet | null = null;
  let completedSessions = 0;

  for (const log of chronological) {
    const sets = completedSetsOf(log, exercise);
    if (sets.length === 0) continue;
    completedSessions += 1;
    const sessionBest = best(sets, (a, b) => compareSets(a, b, exercise) > 0) as RecordSet;
    if (runningBest === null || compareSets(sessionBest, runningBest, exercise) > 0) {
      // The very first session is a baseline, not a "new" PR.
      if (runningBest !== null) prSessionDates.add(log.date);
      runningBest = sessionBest;
    }
    allSets.push(...sets);
  }

  const isWeighted = exercise.loadType === 'WEIGHTED';
  return {
    bestSet: runningBest,
    heaviestSet:
      isWeighted || exercise.loadType === 'BODYWEIGHT'
        ? best(allSets, (a, b) => a.weightKg > b.weightKg + EPSILON || (Math.abs(a.weightKg - b.weightKg) < EPSILON && a.repetitions > b.repetitions))
        : null,
    bestEstimatedOneRepMax:
      isWeighted && exercise.measure === 'REPS'
        ? best(
            allSets.filter((set) => set.estimatedOneRepMaxKg !== null),
            (a, b) => (a.estimatedOneRepMaxKg ?? 0) > (b.estimatedOneRepMaxKg ?? 0) + EPSILON,
          )
        : null,
    mostReps: best(allSets, (a, b) => a.repetitions > b.repetitions || (a.repetitions === b.repetitions && compareSets(a, b, exercise) > 0)),
    completedSessions,
    prSessionDates,
  };
}
