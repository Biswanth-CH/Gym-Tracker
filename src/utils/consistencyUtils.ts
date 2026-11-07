import type { AttendanceMap, DateKey } from '../types/gym';
import {
  addDays,
  endOfMonth,
  formatMonth,
  isSunday,
  mondayIndex,
  parseDateKey,
  startOfMonth,
  toDateKey,
  toMonthKey,
} from './dateUtils';

/**
 * Pure consistency maths. No React, no storage — easy to test and reuse.
 *
 * A "valid gym day" is a Monday–Saturday date that is
 *   - on or after the tracking start (the profile's creation date), and
 *   - on or before today.
 * Sundays, future dates and dates before the profile existed are excluded.
 * ATTENDED counts as a visit; MISSED and unmarked valid days count as non-visits.
 */

export interface TrackerContext {
  /** Today's local date. */
  todayKey: DateKey;
  /** First date that counts (the profile's local creation date). */
  trackingStartKey: DateKey;
}

export type DayState =
  | 'attended'
  | 'missed'
  | 'unmarked'
  | 'sunday'
  | 'future'
  | 'before-start';

export function getDayState(dateKey: DateKey, attendance: AttendanceMap, context: TrackerContext): DayState {
  if (isSunday(parseDateKey(dateKey))) return 'sunday';
  if (dateKey > context.todayKey) return 'future';
  if (dateKey < context.trackingStartKey) return 'before-start';
  const status = attendance.get(dateKey);
  if (status === 'ATTENDED') return 'attended';
  if (status === 'MISSED') return 'missed';
  return 'unmarked';
}

export function isMarkableState(state: DayState): boolean {
  return state === 'attended' || state === 'missed' || state === 'unmarked';
}

export interface PeriodStats {
  visits: number;
  missed: number;
  unmarked: number;
  validDays: number;
  /** Exact ratio × 100, or null when there are no valid days yet. */
  percentage: number | null;
}

/** Statistics for every valid gym day in [fromKey, toKey], clipped to the tracking window. */
export function calculateRangeStats(
  fromKey: DateKey,
  toKey: DateKey,
  attendance: AttendanceMap,
  context: TrackerContext,
): PeriodStats {
  const startKey = fromKey > context.trackingStartKey ? fromKey : context.trackingStartKey;
  const endKey = toKey < context.todayKey ? toKey : context.todayKey;

  const stats: PeriodStats = { visits: 0, missed: 0, unmarked: 0, validDays: 0, percentage: null };
  if (startKey > endKey) return stats;

  for (let day = parseDateKey(startKey); toDateKey(day) <= endKey; day = addDays(day, 1)) {
    if (isSunday(day)) continue;
    stats.validDays += 1;
    const status = attendance.get(toDateKey(day));
    if (status === 'ATTENDED') stats.visits += 1;
    else if (status === 'MISSED') stats.missed += 1;
    else stats.unmarked += 1;
  }

  stats.percentage = stats.validDays > 0 ? (stats.visits / stats.validDays) * 100 : null;
  return stats;
}

export interface MonthInfo {
  year: number;
  /** 0-based month (0 = January). */
  month: number;
  key: string;
  label: string;
  shortLabel: string;
  firstDayKey: DateKey;
  lastDayKey: DateKey;
}

export function getMonthInfo(year: number, month: number): MonthInfo {
  return {
    year,
    month,
    key: toMonthKey(year, month),
    label: formatMonth(year, month, 'long'),
    shortLabel: formatMonth(year, month, 'short'),
    firstDayKey: toDateKey(startOfMonth(year, month)),
    lastDayKey: toDateKey(endOfMonth(year, month)),
  };
}

/** The last `count` months including the current one, oldest first. */
export function getTrackedMonths(todayKey: DateKey, count = 12): MonthInfo[] {
  const today = parseDateKey(todayKey);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    return getMonthInfo(date.getFullYear(), date.getMonth());
  });
}

/**
 * Historical months use the whole month; the current month stops at today;
 * months before the profile existed start at its creation date.
 */
export function calculateMonthStats(month: MonthInfo, attendance: AttendanceMap, context: TrackerContext): PeriodStats {
  return calculateRangeStats(month.firstDayKey, month.lastDayKey, attendance, context);
}

/**
 * Consecutive attended valid days, counting back from today.
 * - Sundays are skipped (they never break a streak).
 * - Today being still unmarked does not break it (the day isn't over).
 * - Any other MISSED or unmarked valid day ends the streak.
 * - Counting stops at the tracking start; future dates are never considered.
 */
export function calculateCurrentStreak(attendance: AttendanceMap, context: TrackerContext): number {
  let streak = 0;
  for (let day = parseDateKey(context.todayKey); ; day = addDays(day, -1)) {
    const key = toDateKey(day);
    if (key < context.trackingStartKey) break;
    if (isSunday(day)) continue;
    const status = attendance.get(key);
    if (status === 'ATTENDED') {
      streak += 1;
    } else if (key === context.todayKey && status === undefined) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Rounded whole-number percentage for display, e.g. 70.59 → "71%". */
export function formatPercentage(percentage: number | null): string {
  return percentage === null ? '—' : `${Math.round(percentage)}%`;
}

/* ---------- Calendar grid ---------- */

export interface CalendarGrid {
  /** Columns of 7 cells (Monday → Sunday). `null` = padding outside the range. */
  weeks: Array<Array<DateKey | null>>;
  /** Column index where each month starts, for the month labels. */
  monthStarts: Array<{ month: MonthInfo; column: number }>;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Builds the week-column grid spanning all `months` (first day of first → last day of last). */
export function buildCalendarGrid(months: MonthInfo[]): CalendarGrid {
  if (months.length === 0) return { weeks: [], monthStarts: [] };
  const rangeStartKey = months[0].firstDayKey;
  const rangeEndKey = months[months.length - 1].lastDayKey;
  const rangeStart = parseDateKey(rangeStartKey);
  const gridStart = addDays(rangeStart, -mondayIndex(rangeStart));

  const weeks: Array<Array<DateKey | null>> = [];
  for (let weekStart = gridStart; toDateKey(weekStart) <= rangeEndKey; weekStart = addDays(weekStart, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const key = toDateKey(addDays(weekStart, offset));
        return key >= rangeStartKey && key <= rangeEndKey ? key : null;
      }),
    );
  }

  const monthStarts = months.map((month) => ({
    month,
    column: Math.floor(daysBetween(gridStart, parseDateKey(month.firstDayKey)) / 7),
  }));

  return { weeks, monthStarts };
}
