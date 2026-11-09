import type { DateKey } from '../types/gym';
import { addDays, parseDateKey, toDateKey } from './dateUtils';

/**
 * X-axis ticks for the body-weight chart (local calendar dates, never UTC).
 *   1–14 days   → day labels "Mon" over "2" (every day up to 7 days, every 2nd day up to 14)
 *   15–90 days  → week markers "Wk 1" + start date "2 Nov" (Last Month uses this)
 *   > 90 days   → month labels "Nov" ("Jan 27" when the year changes)
 * At most MAX_TICKS labels, so they never overlap on a phone-width chart.
 * Ticks only mark the axis; no weight values are generated for missing days.
 */
export interface WeightAxisTick {
  dateKey: DateKey;
  label: string;
  /** Optional second line (week markers show their start date). */
  sublabel?: string;
}

export const MAX_TICKS = 7;
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short' });

function inclusiveDays(start: DateKey, end: DateKey): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / 86_400_000) + 1;
}

/** Thins a list evenly to at most `max` items (always keeps the first). */
function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const step = Math.ceil(items.length / max);
  return items.filter((_, index) => index % step === 0);
}

export function buildWeightAxisTicks(start: DateKey, end: DateKey): WeightAxisTick[] {
  if (end < start) return [];
  const lengthDays = inclusiveDays(start, end);
  const startDate = parseDateKey(start);

  if (lengthDays <= 14) {
    const step = lengthDays <= MAX_TICKS ? 1 : 2;
    const ticks: WeightAxisTick[] = [];
    for (let offset = 0; offset < lengthDays; offset += step) {
      const date = addDays(startDate, offset);
      // Weekday and date on two lines so seven labels fit a phone-width chart without touching.
      ticks.push({ dateKey: toDateKey(date), label: WEEKDAY.format(date), sublabel: String(date.getDate()) });
    }
    return ticks;
  }

  if (lengthDays <= 90) {
    const weeks: WeightAxisTick[] = [];
    for (let offset = 0, week = 1; offset < lengthDays; offset += 7, week += 1) {
      const date = addDays(startDate, offset);
      weeks.push({ dateKey: toDateKey(date), label: `Wk ${week}`, sublabel: DAY_MONTH.format(date) });
    }
    return thin(weeks, MAX_TICKS);
  }

  const monthStarts: Date[] = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth() + (startDate.getDate() === 1 ? 0 : 1), 1);
  const endDate = parseDateKey(end);
  while (cursor <= endDate) {
    monthStarts.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  // Label after thinning so the year shows on the first visible month of a new year.
  let previousYear = startDate.getFullYear();
  return thin(monthStarts, MAX_TICKS).map((monthStart) => {
    const yearChanged = monthStart.getFullYear() !== previousYear;
    previousYear = monthStart.getFullYear();
    return {
      dateKey: toDateKey(monthStart),
      label: yearChanged ? `${MONTH.format(monthStart)} ${String(monthStart.getFullYear()).slice(-2)}` : MONTH.format(monthStart),
    };
  });
}
