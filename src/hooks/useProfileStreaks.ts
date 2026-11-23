import { useMemo } from 'react';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import { calculateCurrentStreak } from '../utils/consistencyUtils';
import { useCloudSlice } from './useCloud';
import { useToday } from './useToday';

/**
 * Current streak for every profile (Profiles page tiles and leaderboard). Uses the same calculation and
 * tracking-start context as the Consistency Tracker, and recomputes whenever attendance
 * changes on any device (Realtime) or the local date rolls over.
 */
export interface ProfileStreaks {
  /** Ongoing streak (calculateCurrentStreak) — shown on tiles and used to rank the leaderboard. */
  currentStreak: number;
}

export function useProfileStreaks(profiles: readonly Profile[]): ReadonlyMap<string, ProfileStreaks> {
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
      profiles.map((profile) => {
        const attendance = attendanceByProfile.get(profile.id) ?? new Map<DateKey, AttendanceStatus>();
        const context = { todayKey, trackingStartKey: profile.trackingStartDate <= todayKey ? profile.trackingStartDate : todayKey };
        return [profile.id, { currentStreak: calculateCurrentStreak(attendance, context) }];
      }),
    );
  }, [attendanceRows, profiles, todayKey]);
}
