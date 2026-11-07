import type { DateKey, WeightUnit } from '../types/gym';
import { addDays, isValidDateKey, parseDateKey, toDateKey } from './dateUtils';
import { convertWeight, formatNumber, unitLabel } from './workoutUtils';

/** Differences smaller than this (kg) are described as almost unchanged. */
export const UNCHANGED_THRESHOLD_KG = 0.05;

export interface WeightPoint {
  date: DateKey;
  weightKg: number;
}

export interface DateWindow {
  start: DateKey;
  end: DateKey;
  previousStart: DateKey;
  previousEnd: DateKey;
  lengthDays: number;
}

export interface WeightComparison {
  currentAverageKg: number | null;
  previousAverageKg: number | null;
  currentCount: number;
  previousCount: number;
  differenceKg: number | null;
  tone: 'down' | 'up' | 'unchanged' | 'insufficient';
}

function inclusiveDays(start: DateKey, end: DateKey): number {
  let count = 1;
  for (let day = parseDateKey(start); toDateKey(day) < end; day = addDays(day, 1)) count += 1;
  return count;
}

export function rollingWindow(today: DateKey, lengthDays: number): DateWindow {
  const end = parseDateKey(today);
  const start = addDays(end, -(lengthDays - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(lengthDays - 1));
  return {
    start: toDateKey(start),
    end: today,
    previousStart: toDateKey(previousStart),
    previousEnd: toDateKey(previousEnd),
    lengthDays,
  };
}

export function customWindow(start: DateKey, end: DateKey, today: DateKey): DateWindow | string {
  if (!isValidDateKey(start) || !isValidDateKey(end)) return 'Choose a valid start and end date.';
  if (start > end) return 'The start date must be on or before the end date.';
  if (end > today || start > today) return 'Future dates can’t be included.';
  const lengthDays = inclusiveDays(start, end);
  const previousEnd = addDays(parseDateKey(start), -1);
  const previousStart = addDays(previousEnd, -(lengthDays - 1));
  return {
    start,
    end,
    previousStart: toDateKey(previousStart),
    previousEnd: toDateKey(previousEnd),
    lengthDays,
  };
}

function averageInRange(points: readonly WeightPoint[], start: DateKey, end: DateKey): { average: number | null; count: number } {
  const matched = points.filter((point) => point.date >= start && point.date <= end);
  if (matched.length === 0) return { average: null, count: 0 };
  const total = matched.reduce((sum, point) => sum + point.weightKg, 0);
  return { average: total / matched.length, count: matched.length };
}

export function compareWeightPeriods(points: readonly WeightPoint[], window: DateWindow): WeightComparison {
  const current = averageInRange(points, window.start, window.end);
  const previous = averageInRange(points, window.previousStart, window.previousEnd);
  if (current.average === null || previous.average === null) {
    return {
      currentAverageKg: current.average,
      previousAverageKg: previous.average,
      currentCount: current.count,
      previousCount: previous.count,
      differenceKg: null,
      tone: 'insufficient',
    };
  }
  const differenceKg = current.average - previous.average;
  const tone = Math.abs(differenceKg) < UNCHANGED_THRESHOLD_KG ? 'unchanged' : differenceKg < 0 ? 'down' : 'up';
  return {
    currentAverageKg: current.average,
    previousAverageKg: previous.average,
    currentCount: current.count,
    previousCount: previous.count,
    differenceKg,
    tone,
  };
}

export function pointsInWindow(points: readonly WeightPoint[], start: DateKey, end: DateKey): WeightPoint[] {
  return points.filter((point) => point.date >= start && point.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}

export type ComparisonPeriodLabel = 'week' | 'month' | 'period';

export function formatWeightComparison(comparison: WeightComparison, unit: WeightUnit, period: ComparisonPeriodLabel): string {
  if (comparison.tone === 'insufficient' || comparison.differenceKg === null) {
    return 'Add more weight entries to see your comparison.';
  }
  const displayed = Math.abs(convertWeight(comparison.differenceKg, 'KG', unit));
  const amount = `${formatNumber(displayed)} ${unitLabel(unit)}`;
  if (comparison.tone === 'unchanged') {
    const against = period === 'week' ? 'last week' : period === 'month' ? 'last month' : 'the previous period';
    return `Your average weight remained almost unchanged compared with ${against}.`;
  }
  const direction = comparison.tone === 'down' ? 'decreased' : 'increased';
  const against = period === 'week' ? 'the previous week' : period === 'month' ? 'the previous month' : 'the previous period';
  return `Your average weight ${direction} by ${amount} compared with ${against}.`;
}

export function formatAverage(weightKg: number | null, unit: WeightUnit): string {
  if (weightKg === null) return '—';
  return `${formatNumber(convertWeight(weightKg, 'KG', unit))} ${unitLabel(unit)}`;
}
