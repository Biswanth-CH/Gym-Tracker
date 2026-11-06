import { useCallback, useEffect, useState } from 'react';
import {
  getExercisePreference,
  subscribeToPreferenceChanges,
  updateExercisePreference,
} from '../services/exerciseStorageService';
import {
  deleteExerciseLog,
  getExerciseLogs,
  getLatestLogsByExercise,
  saveExerciseLog,
  subscribeToWorkoutChanges,
} from '../services/workoutStorageService';
import type { DateKey, ExercisePreference, ExercisePreferenceChanges, WorkoutExerciseLog, WorkoutSet } from '../types/gym';

export interface UseExerciseWorkoutResult {
  /** Newest first. */
  logs: WorkoutExerciseLog[];
  preference: ExercisePreference;
  loadError: string | null;
  /** All mutations throw a user-facing Error on failure. */
  saveSession: (date: DateKey, sets: WorkoutSet[]) => WorkoutExerciseLog;
  deleteSession: (date: DateKey) => void;
  updatePreference: (changes: ExercisePreferenceChanges) => void;
}

/** One exercise's history + preference for one profile, kept in sync across tabs. */
export function useExerciseWorkout(profileId: string, exerciseId: string): UseExerciseWorkoutResult {
  const [logs, setLogs] = useState<WorkoutExerciseLog[]>([]);
  const [preference, setPreference] = useState<ExercisePreference>(() => getExercisePreference(profileId, exerciseId));
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setLogs(getExerciseLogs(profileId, exerciseId));
      setPreference(getExercisePreference(profileId, exerciseId));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load workout history.');
    }
  }, [profileId, exerciseId]);

  useEffect(() => {
    reload();
    const unsubscribeLogs = subscribeToWorkoutChanges(reload);
    const unsubscribePrefs = subscribeToPreferenceChanges(reload);
    return () => {
      unsubscribeLogs();
      unsubscribePrefs();
    };
  }, [reload]);

  const saveSession = useCallback(
    (date: DateKey, sets: WorkoutSet[]) => {
      const saved = saveExerciseLog(profileId, exerciseId, date, sets);
      setLogs(getExerciseLogs(profileId, exerciseId));
      return saved;
    },
    [profileId, exerciseId],
  );

  const deleteSession = useCallback(
    (date: DateKey) => {
      deleteExerciseLog(profileId, exerciseId, date);
      setLogs(getExerciseLogs(profileId, exerciseId));
    },
    [profileId, exerciseId],
  );

  const updatePreference = useCallback(
    (changes: ExercisePreferenceChanges) => {
      setPreference(updateExercisePreference(profileId, exerciseId, changes));
    },
    [profileId, exerciseId],
  );

  return { logs, preference, loadError, saveSession, deleteSession, updatePreference };
}

/** Latest session per exercise (for "last time" hints in exercise lists). */
export function useLatestLogs(profileId: string): Map<string, WorkoutExerciseLog> {
  const [latest, setLatest] = useState<Map<string, WorkoutExerciseLog>>(() => new Map());

  useEffect(() => {
    const reload = () => {
      try {
        setLatest(getLatestLogsByExercise(profileId));
      } catch {
        setLatest(new Map());
      }
    };
    reload();
    return subscribeToWorkoutChanges(reload);
  }, [profileId]);

  return latest;
}
