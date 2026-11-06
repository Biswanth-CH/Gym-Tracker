import { useCallback, useMemo } from 'react';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import type { TrackerContext } from '../utils/consistencyUtils';
import { formatShortDate, isoToLocalDateKey } from '../utils/dateUtils';
import { useAttendance } from './useAttendance';
import type { ToastTone } from './useToast';
import { useToday } from './useToday';

/**
 * Attendance state + the "mark / change / clear with confirmation" action,
 * shared by the dashboard quick log and the Consistency Tracker so there is
 * exactly one attendance code path.
 */
export function useAttendanceTracker(profile: Profile, showToast: (message: string, tone?: ToastTone) => void) {
  const todayKey = useToday();
  const { attendance, loadError, mark, clear } = useAttendance(profile.id);

  const context: TrackerContext = useMemo(
    () => ({ todayKey, trackingStartKey: isoToLocalDateKey(profile.createdAt) ?? todayKey }),
    [todayKey, profile.createdAt],
  );

  /** Returns true when the change was saved. */
  const choose = useCallback(
    (date: DateKey, status: AttendanceStatus | null): boolean => {
      try {
        if (status === null) {
          clear(date);
          showToast(`Cleared ${formatShortDate(date)}`, 'info');
        } else {
          mark(date, status);
          showToast(
            `${formatShortDate(date)}: ${status === 'ATTENDED' ? 'went to gym' : 'did not go'}`,
            status === 'ATTENDED' ? 'success' : 'info',
          );
        }
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save attendance.', 'error');
        return false;
      }
    },
    [clear, mark, showToast],
  );

  return { todayKey, attendance, loadError, context, choose };
}
