import { useCallback, useMemo } from 'react';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import type { TrackerContext } from '../utils/consistencyUtils';
import { formatShortDate } from '../utils/dateUtils';
import { errorMessage } from '../services/cloud/cloudErrors';
import { useAttendance } from './useCloud';
import type { ToastTone } from './useToast';
import { useToday } from './useToday';

/**
 * Attendance state + the "mark / change / clear with confirmation" action,
 * shared by the dashboard quick log and the Consistency Tracker so there is
 * exactly one attendance code path (cloud-backed).
 */
export function useAttendanceTracker(profile: Profile, showToast: (message: string, tone?: ToastTone) => void) {
  const todayKey = useToday();
  const { attendance, mark, clear } = useAttendance(profile.id);

  const context: TrackerContext = useMemo(
    () => ({ todayKey, trackingStartKey: profile.trackingStartDate <= todayKey ? profile.trackingStartDate : todayKey }),
    [todayKey, profile.trackingStartDate],
  );

  /** Resolves true when the change was saved to the cloud. */
  const choose = useCallback(
    async (date: DateKey, status: AttendanceStatus | null): Promise<boolean> => {
      try {
        if (status === null) {
          await clear(date);
          showToast(`Cleared ${formatShortDate(date)}`, 'info');
        } else {
          await mark(date, status);
          showToast(
            `${formatShortDate(date)}: ${status === 'ATTENDED' ? 'went to gym' : 'did not go'}`,
            status === 'ATTENDED' ? 'success' : 'info',
          );
        }
        return true;
      } catch (error) {
        showToast(errorMessage(error, 'Could not save attendance.'), 'error');
        return false;
      }
    },
    [clear, mark, showToast],
  );

  return { todayKey, attendance, loadError: null as string | null, context, choose };
}
