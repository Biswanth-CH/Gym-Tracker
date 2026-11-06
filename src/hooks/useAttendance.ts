import { useCallback, useEffect, useState } from 'react';
import {
  clearAttendance,
  getAttendanceMap,
  markAttendance,
  subscribeToAttendanceChanges,
} from '../services/attendanceStorageService';
import type { AttendanceMap, AttendanceStatus, DateKey } from '../types/gym';

export interface UseAttendanceResult {
  attendance: AttendanceMap;
  loadError: string | null;
  /** Throws with a user-facing message on failure. */
  mark: (date: DateKey, status: AttendanceStatus) => void;
  /** Throws with a user-facing message on failure. */
  clear: (date: DateKey) => void;
}

const EMPTY: AttendanceMap = new Map();

/** One profile's attendance as React state, kept in sync across tabs. */
export function useAttendance(profileId: string): UseAttendanceResult {
  const [attendance, setAttendance] = useState<AttendanceMap>(EMPTY);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setAttendance(getAttendanceMap(profileId));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load attendance.');
    }
  }, [profileId]);

  useEffect(() => {
    reload();
    return subscribeToAttendanceChanges(reload);
  }, [reload]);

  const mark = useCallback(
    (date: DateKey, status: AttendanceStatus) => {
      markAttendance(profileId, date, status);
      setAttendance(getAttendanceMap(profileId));
    },
    [profileId],
  );

  const clear = useCallback(
    (date: DateKey) => {
      clearAttendance(profileId, date);
      setAttendance(getAttendanceMap(profileId));
    },
    [profileId],
  );

  return { attendance, loadError, mark, clear };
}
