import { useCallback, useMemo, useSyncExternalStore } from 'react';
import * as profileService from '../services/cloud/profileService';
import {
  attendanceService,
  dailySetTrackerService,
  exerciseSelectionService,
  personalRecordService,
  setTemplateService,
} from '../services/cloud/trackingServices';
import { toPersonalRecord, toProfile, toSelection, toTemplate, toTrackerState } from '../services/cloud/rows';
import { cloudStore, type CloudSnapshot } from '../store/cloudStore';
import type {
  AttendanceMap,
  AttendanceStatus,
  DateKey,
  ExerciseSelection,
  PersonalRecord,
  PersonalRecordInput,
  Profile,
  ProfileInput,
  SetPlan,
  SetTemplate,
} from '../types/gym';

/** Subscribes to one slice of the cloud store (re-renders only when it changes). */
export function useCloudSlice<T>(selector: (snapshot: CloudSnapshot) => T): T {
  return useSyncExternalStore(cloudStore.subscribe, () => selector(cloudStore.getSnapshot()));
}

export function useCloudStatus() {
  const phase = useCloudSlice((s) => s.phase);
  const connection = useCloudSlice((s) => s.connection);
  const syncing = useCloudSlice((s) => s.syncing);
  const error = useCloudSlice((s) => s.error);
  const lastSyncedAt = useCloudSlice((s) => s.lastSyncedAt);
  return { phase, connection, syncing, error, lastSyncedAt };
}

/* ---------------- Profiles ---------------- */

export function useProfiles() {
  const rows = useCloudSlice((s) => s.profiles);
  const photoUrls = useCloudSlice((s) => s.photoUrls);
  const userId = useCloudSlice((s) => s.userId);

  const profiles: Profile[] = useMemo(
    () =>
      rows
        .map((row) => toProfile(row, row.photo_path ? photoUrls[row.photo_path] ?? null : null))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)),
    [rows, photoUrls],
  );

  const requireUser = () => {
    if (!userId) throw new Error('You are signed out. Please sign in again.');
    return userId;
  };

  const addProfile = useCallback(async (input: ProfileInput) => {
    await profileService.createProfile(requireUser(), input, profiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, userId]);

  const editProfile = useCallback(async (profile: Profile, input: ProfileInput) => {
    await profileService.updateProfile(requireUser(), profile, input, profiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, userId]);

  const removeProfile = useCallback(async (profileId: string) => {
    await profileService.deleteProfile(requireUser(), profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { profiles, addProfile, editProfile, removeProfile };
}

/* ---------------- Attendance ---------------- */

export function useAttendance(profileId: string) {
  const rows = useCloudSlice((s) => s.attendance);
  const attendance: AttendanceMap = useMemo(
    () => new Map(rows.filter((row) => row.profile_id === profileId).map((row) => [row.date, row.status])),
    [rows, profileId],
  );
  const mark = useCallback((date: DateKey, status: AttendanceStatus) => attendanceService.setStatus(profileId, date, status), [profileId]);
  const clear = useCallback((date: DateKey) => attendanceService.clear(profileId, date), [profileId]);
  return { attendance, mark, clear };
}

/* ---------------- Daily exercise selections ---------------- */

export function useExerciseSelections(profileId: string) {
  const rows = useCloudSlice((s) => s.selections);
  const selections: ExerciseSelection[] = useMemo(
    () => rows.filter((row) => row.profile_id === profileId).map(toSelection),
    [rows, profileId],
  );
  const byDate = useMemo(() => {
    const map = new Map<DateKey, string[]>();
    for (const selection of selections) map.set(selection.date, [...(map.get(selection.date) ?? []), selection.exerciseId]);
    return map;
  }, [selections]);

  const isSelected = useCallback(
    (exerciseId: string, date: DateKey) => selections.some((s) => s.exerciseId === exerciseId && s.date === date),
    [selections],
  );
  const select = useCallback((exerciseId: string, date: DateKey) => exerciseSelectionService.select(profileId, exerciseId, date), [profileId]);
  const deselect = useCallback((exerciseId: string, date: DateKey) => exerciseSelectionService.deselect(profileId, exerciseId, date), [profileId]);
  return { selections, byDate, isSelected, select, deselect };
}

/* ---------------- Set plan, daily tracker, PR (per exercise) ---------------- */

export function useSetTemplate(profileId: string, exerciseId: string) {
  const rows = useCloudSlice((s) => s.templates);
  const template: SetTemplate | null = useMemo(() => {
    const row = rows.find((r) => r.profile_id === profileId && r.exercise_id === exerciseId);
    return row ? toTemplate(row) : null;
  }, [rows, profileId, exerciseId]);
  const save = useCallback(
    (plan: SetPlan, measure: 'REPS' | 'SECONDS') => setTemplateService.save(profileId, exerciseId, plan, measure),
    [profileId, exerciseId],
  );
  return { template, save };
}

export function useDailyTracker(profileId: string, exerciseId: string, date: DateKey) {
  const rows = useCloudSlice((s) => s.trackers);
  const completed: ReadonlySet<number> = useMemo(() => {
    const row = rows.find((r) => r.profile_id === profileId && r.exercise_id === exerciseId && r.date === date);
    return new Set(row ? toTrackerState(row).completedSets : []);
  }, [rows, profileId, exerciseId, date]);
  const setCompleted = useCallback(
    (indexes: number[]) => dailySetTrackerService.setCompleted(profileId, exerciseId, date, indexes),
    [profileId, exerciseId, date],
  );
  return { completed, setCompleted };
}

export function usePersonalRecord(profileId: string, exerciseId: string) {
  const rows = useCloudSlice((s) => s.records);
  const record: PersonalRecord | null = useMemo(() => {
    const row = rows.find((r) => r.profile_id === profileId && r.exercise_id === exerciseId);
    return row ? toPersonalRecord(row) : null;
  }, [rows, profileId, exerciseId]);
  const save = useCallback(
    (input: PersonalRecordInput, measure: 'REPS' | 'SECONDS', needsWeight: boolean) =>
      personalRecordService.save(profileId, exerciseId, input, measure, needsWeight),
    [profileId, exerciseId],
  );
  const remove = useCallback(async () => {
    if (record) await personalRecordService.remove(record.id);
  }, [record]);
  return { record, save, remove };
}

/** All PRs of a profile keyed by exercise id (for list hints). */
export function usePersonalRecordsByExercise(profileId: string): Map<string, PersonalRecord> {
  const rows = useCloudSlice((s) => s.records);
  return useMemo(() => {
    const map = new Map<string, PersonalRecord>();
    for (const row of rows) {
      if (row.profile_id !== profileId) continue;
      const record = toPersonalRecord(row);
      if (record) map.set(record.exerciseId, record);
    }
    return map;
  }, [rows, profileId]);
}
