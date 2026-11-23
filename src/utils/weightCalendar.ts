import type { DateKey, WeightUnit } from '../types/gym';
import { endOfMonth, mondayIndex, startOfMonth, toDateKey } from './dateUtils';
import { convertWeight } from './workoutUtils';

/**
 * Weight Data calendar (Phase 7): one month, Monday-first like the attendance calendar.
 * Weeks are arrays of 7 cells; days outside the month are null.
 */
export function buildMonthWeeks(year: number, month: number): Array<Array<DateKey | null>> {
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);
  const cells: Array<DateKey | null> = Array.from({ length: mondayIndex(first) }, () => null);
  for (let day = 1; day <= last.getDate(); day += 1) cells.push(toDateKey(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<DateKey | null>> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** Short value that fits a phone-width cell: one decimal, no unit ("78.5", "173.1"). */
export function formatWeightCell(weightKg: number, unit: WeightUnit): string {
  const value = convertWeight(weightKg, 'KG', unit);
  return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

/** Moves a {year, month} pair by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
