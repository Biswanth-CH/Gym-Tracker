import type { AttendanceStatus, BodyWeightEntry, DateKey, WeightUnit } from '../types/gym';
import { convertWeight, formatNumber } from './workoutUtils';

/**
 * Weekly Plan header (Phase 8): headings that follow today's attendance mark and
 * today's body weight. Pure helpers so every state is unit-tested.
 */

export type TodayTone = 'success' | 'danger' | 'neutral';

/** Went → green "Eeroju Vella 🥳"; Did not go → red "Eeroju Vellala 😞"; nothing / cleared → "Eeroju gym ki vellava?". */
export function attendanceHeading(status: AttendanceStatus | undefined | null): { text: string; tone: TodayTone } {
  if (status === 'ATTENDED') return { text: 'Eeroju Vella 🥳', tone: 'success' };
  if (status === 'MISSED') return { text: 'Eeroju Vellala 😞', tone: 'danger' };
  return { text: 'Eeroju gym ki vellava?', tone: 'neutral' };
}

/** "Eeroju weight entha?" until today's weight exists, then green "Eeroju weight". */
export function weightHeading(todayEntry: Pick<BodyWeightEntry, 'weightKg'> | null | undefined): { text: string; tone: TodayTone } {
  return todayEntry ? { text: 'Eeroju weight', tone: 'success' } : { text: 'Eeroju weight entha?', tone: 'neutral' };
}

/**
 * Today's entry, looked up by the LOCAL calendar date key (the same key the weight
 * dialog saves under), so a late-evening entry never lands on the next / previous day.
 */
export function todayWeightEntry<T extends Pick<BodyWeightEntry, 'date'>>(entries: ReadonlyMap<DateKey, T>, todayKey: DateKey): T | null {
  return entries.get(todayKey) ?? null;
}

export type TodayLogTone = 'success' | 'warning' | 'danger';

/**
 * Weekly Plan button for today's data: both parts logged → green "Logged data"; one →
 * yellow "Logged partially!"; none → red "Log today's data". On days attendance can't be
 * marked (Sunday, before tracking starts) only the weight counts.
 */
export function todayLogStatus(input: { attendanceMarkable: boolean; attendance: AttendanceStatus | undefined | null; hasWeight: boolean }): { label: string; tone: TodayLogTone; done: number; total: number } {
  const total = input.attendanceMarkable ? 2 : 1;
  const done = (input.attendanceMarkable && input.attendance ? 1 : 0) + (input.hasWeight ? 1 : 0);
  if (done === total) return { label: 'Logged data', tone: 'success', done, total };
  if (done > 0) return { label: 'Logged partially!', tone: 'warning', done, total };
  return { label: 'Log today’s data', tone: 'danger', done, total };
}

/** "78.5 kg" / "173.1 lb" in the device's preferred unit (stored in kg). */
export function formatTodayWeight(weightKg: number, unit: WeightUnit): string {
  return `${formatNumber(convertWeight(weightKg, 'KG', unit))} ${unit === 'KG' ? 'kg' : 'lb'}`;
}
