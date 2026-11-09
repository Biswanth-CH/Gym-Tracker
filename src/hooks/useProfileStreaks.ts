import { useMemo } from 'react';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import { calculateCurrentStreak } from '../utils/consistencyUtils';
import { useCloudSlice } from './useCloud';
import { useToday } from './useToday';

/**
 * Current streak for every profile (Profiles page). Uses the same calculation and
 * tracking-start context as the Consistency Tracker, and recomputes whenever attendance
 * changes on any device (Realtime) or the local date rolls over.
 */
export function useProfileStreaks(profiles: readonly Profile[]): ReadonlyMap<string, number> {
  const attendanceRows = useCloudSlice((snapshot) => snapshot.attendance);
  const todayKey = useToday();
  return useMemo(() => {
    const attendanceByProfile = new Map<string, Map<DateKey, AttendanceStatus>>();
    for (const row of attendanceRows) {
      const attendance = attendanceByProfile.get(row.profile_id) ?? new Map<DateKey, AttendanceStatus>();
      attendance.set(row.date, row.status);
      attendanceByProfile.set(row.profile_id, attendance);
    }
    return new Map(
      profiles.map((profile) => [
        profile.id,
        calculateCurrentStreak(attendanceByProfile.get(profile.id) ?? new Map(), {
          todayKey,
          trackingStartKey: profile.trackingStartDate <= todayKey ? profile.trackingStartDate : todayKey,
        }),
      ]),
    );
  }, [attendanceRows, profiles, todayKey]);
}
