import { STORAGE_KEYS } from '../constants/storageKeys';
import type { DateKey, WeightUnit, WorkoutExerciseLog, WorkoutSet } from '../types/gym';
import { isValidDateKey, toDateKey } from '../utils/dateUtils';
import { generateId } from '../utils/profileUtils';
import { MAX_SETS_PER_SESSION, renumberSets } from '../utils/workoutUtils';
import { readJson, subscribeToKey, writeJson } from './localStorageClient';

/**
 * Workout history, stored separately from profiles and attendance under
 * `gym-tracker-workout-logs`:
 *
 *   { "<profileId>": { "<exerciseId>": { "YYYY-MM-DD": StoredLog } } }
 *
 * The nesting makes (profile, exercise, date) unique by construction, so a
 * second save for the same date edits that session instead of duplicating it.
 * Each write re-reads the store and replaces only one profile/exercise/date entry.
 * Workout logs are independent of attendance.
 */

interface StoredLog {
  id: string;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}

type ExerciseLogs = Record<DateKey, StoredLog>;
type ProfileLogs = Record<string, ExerciseLogs>;
type LogStore = Record<string, ProfileLogs>;

export class WorkoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkoutValidationError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUnit = (value: unknown): value is WeightUnit => value === 'KG' || value === 'LB';
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

function parseSet(value: unknown, index: number): WorkoutSet | null {
  if (!isObject(value)) return null;
  if (!isNullableNumber(value.weight) || !isNullableNumber(value.repetitions) || typeof value.completed !== 'boolean') return null;
  return {
    id: typeof value.id === 'string' ? value.id : generateId(),
    setNumber: index + 1,
    weight: value.weight,
    weightUnit: isUnit(value.weightUnit) ? value.weightUnit : 'KG',
    repetitions: value.repetitions === null ? null : Math.round(value.repetitions),
    completed: value.completed,
  };
}

/** Reads the store, dropping malformed profiles / exercises / dates / sets individually. */
function readStore(): LogStore {
  const result = readJson(STORAGE_KEYS.workoutLogs);
  if (result.kind !== 'ok' || !isObject(result.value)) return {};

  const store: LogStore = {};
  for (const [profileId, exercises] of Object.entries(result.value)) {
    if (!isObject(exercises)) continue;
    const profileLogs: ProfileLogs = {};
    for (const [exerciseId, dates] of Object.entries(exercises)) {
      if (!isObject(dates)) continue;
      const exerciseLogs: ExerciseLogs = {};
      for (const [date, raw] of Object.entries(dates)) {
        if (!isValidDateKey(date) || !isObject(raw) || !Array.isArray(raw.sets)) continue;
        const sets = raw.sets.map(parseSet).filter((set): set is WorkoutSet => set !== null);
        exerciseLogs[date] = {
          id: typeof raw.id === 'string' ? raw.id : generateId(),
          sets: renumberSets(sets),
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
        };
      }
      profileLogs[exerciseId] = exerciseLogs;
    }
    store[profileId] = profileLogs;
  }
  return store;
}

const toLog = (profileId: string, exerciseId: string, date: DateKey, stored: StoredLog): WorkoutExerciseLog => ({
  id: stored.id,
  profileId,
  exerciseId,
  date,
  sets: stored.sets,
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
});

/** All sessions of one exercise for one profile, newest first. */
export function getExerciseLogs(profileId: string, exerciseId: string): WorkoutExerciseLog[] {
  const dates = readStore()[profileId]?.[exerciseId] ?? {};
  return Object.entries(dates)
    .map(([date, stored]) => toLog(profileId, exerciseId, date, stored))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getExerciseLog(profileId: string, exerciseId: string, date: DateKey): WorkoutExerciseLog | null {
  const stored = readStore()[profileId]?.[exerciseId]?.[date];
  return stored ? toLog(profileId, exerciseId, date, stored) : null;
}

/** Latest session per exercise for a profile (for "last time" hints in lists). */
export function getLatestLogsByExercise(profileId: string): Map<string, WorkoutExerciseLog> {
  const latest = new Map<string, WorkoutExerciseLog>();
  for (const [exerciseId, dates] of Object.entries(readStore()[profileId] ?? {})) {
    const newestDate = Object.keys(dates).sort().pop();
    if (newestDate) latest.set(exerciseId, toLog(profileId, exerciseId, newestDate, dates[newestDate]));
  }
  return latest;
}

/** Creates or updates the single session for (profile, exercise, date). */
export function saveExerciseLog(profileId: string, exerciseId: string, date: DateKey, sets: WorkoutSet[]): WorkoutExerciseLog {
  if (!isValidDateKey(date)) throw new WorkoutValidationError('Please choose a valid date.');
  if (date > toDateKey(new Date())) throw new WorkoutValidationError('Workouts can’t be logged for future dates.');
  if (sets.length === 0) throw new WorkoutValidationError('Add at least one set before saving.');
  if (sets.length > MAX_SETS_PER_SESSION) throw new WorkoutValidationError(`A session can have at most ${MAX_SETS_PER_SESSION} sets.`);

  const cleanSets = renumberSets(
    sets.map((set, index) => {
      const parsed = parseSet(set, index);
      if (!parsed) throw new WorkoutValidationError(`Set ${index + 1} has invalid values.`);
      return parsed;
    }),
  );

  const store = readStore();
  const profileLogs = store[profileId] ?? {};
  const exerciseLogs = profileLogs[exerciseId] ?? {};
  const existing = exerciseLogs[date];
  const now = new Date().toISOString();
  const stored: StoredLog = {
    id: existing?.id ?? generateId(),
    sets: cleanSets,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  store[profileId] = { ...profileLogs, [exerciseId]: { ...exerciseLogs, [date]: stored } };
  writeJson(STORAGE_KEYS.workoutLogs, store);
  return toLog(profileId, exerciseId, date, stored);
}

export function deleteExerciseLog(profileId: string, exerciseId: string, date: DateKey): void {
  const store = readStore();
  const exerciseLogs = store[profileId]?.[exerciseId];
  if (!exerciseLogs || !(date in exerciseLogs)) return;
  const { [date]: _removed, ...rest } = exerciseLogs;
  store[profileId] = { ...store[profileId], [exerciseId]: rest };
  writeJson(STORAGE_KEYS.workoutLogs, store);
}

export function deleteWorkoutLogsForProfile(profileId: string): void {
  const store = readStore();
  if (!(profileId in store)) return;
  delete store[profileId];
  writeJson(STORAGE_KEYS.workoutLogs, store);
}

export function subscribeToWorkoutChanges(onChange: () => void): () => void {
  return subscribeToKey(STORAGE_KEYS.workoutLogs, onChange);
}
