import { describe, expect, it } from 'vitest';
import { compareWeightPeriods, customWindow, formatWeightComparison, pointsInWindow, rollingWindow } from './bodyWeightAnalytics';
import type { WeightPoint } from './bodyWeightAnalytics';

const points: WeightPoint[] = [
  { date: '2026-10-25', weightKg: 80 },
  { date: '2026-10-31', weightKg: 80.4 },
  { date: '2026-11-02', weightKg: 80 },
  { date: '2026-11-06', weightKg: 79.6 },
];

describe('body weight comparisons', () => {
  it('compares the last 7 days with the previous 7 days', () => {
    const window = rollingWindow('2026-11-07', 7);
    expect(window).toMatchObject({ start: '2026-11-01', end: '2026-11-07', previousStart: '2026-10-25', previousEnd: '2026-10-31' });
    const comparison = compareWeightPeriods(points, window);
    expect(comparison.currentCount).toBe(2);
    expect(comparison.previousCount).toBe(2);
    expect(comparison.currentAverageKg).toBeCloseTo(79.8);
    expect(comparison.previousAverageKg).toBeCloseTo(80.2);
    expect(comparison.tone).toBe('down');
    expect(formatWeightComparison(comparison, 'KG', 'week')).toMatch(/decreased by 0.4 kg compared with the previous week/);
  });

  it('does not invent a change when either period has no entries', () => {
    const comparison = compareWeightPeriods([{ date: '2026-11-07', weightKg: 70 }], rollingWindow('2026-11-07', 7));
    expect(comparison.tone).toBe('insufficient');
    expect(formatWeightComparison(comparison, 'KG', 'week')).toMatch(/Add more weight entries/);
  });

  it('calls a tiny difference almost unchanged and converts the summary to pounds', () => {
    const window = rollingWindow('2026-11-07', 30);
    const steady: WeightPoint[] = [
      { date: '2026-09-20', weightKg: 70 },
      { date: '2026-11-05', weightKg: 70.02 },
    ];
    const comparison = compareWeightPeriods(steady, window);
    expect(comparison.tone).toBe('unchanged');
    expect(formatWeightComparison(comparison, 'LB', 'month')).toMatch(/almost unchanged compared with last month/);
  });

  it('compares a custom range with the immediately previous period of equal length', () => {
    const window = customWindow('2026-11-01', '2026-11-07', '2026-11-07');
    expect(typeof window).not.toBe('string');
    if (typeof window === 'string') return;
    expect(window.previousStart).toBe('2026-10-25');
    expect(window.previousEnd).toBe('2026-10-31');
    expect(pointsInWindow(points, window.start, window.end).map((point) => point.date)).toEqual(['2026-11-02', '2026-11-06']);
    expect(customWindow('2026-11-08', '2026-11-09', '2026-11-07')).toMatch(/Future/);
    expect(customWindow('2026-11-07', '2026-11-01', '2026-11-07')).toMatch(/start date/);
  });
});
