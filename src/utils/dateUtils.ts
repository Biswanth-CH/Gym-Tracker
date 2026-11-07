import type { DateKey } from '../types/gym';

/**
 * All attendance logic works on LOCAL calendar dates encoded as `YYYY-MM-DD`.
 * Never use `toISOString()` for dates: it converts to UTC and can shift the
 * day backwards/forwards depending on the user's timezone.
 */

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Local midnight of the given key. Caller must pass a valid key. */
export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Calendar-safe day arithmetic (DST-proof, unlike adding 86_400_000 ms). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Monday = 0 … Sunday = 6 (gym weeks start on Monday). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/** `YYYY-MM`, used to identify a month. */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

/** Local date of an ISO timestamp (e.g. a profile's `createdAt`). */
export function isoToLocalDateKey(iso: string): DateKey | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
}

export function formatLongDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMonth(year: number, month: number, style: 'short' | 'long' = 'long'): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: style });
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
