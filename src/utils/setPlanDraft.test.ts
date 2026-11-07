import { describe, expect, it } from 'vitest';
import { applyRepsToAllSets, applyWeightToAllSets, canApplyToAllSets, type SetDraftRow } from './setPlanDraft';
import { convertWeight, formatNumber } from './workoutUtils';

const rows: SetDraftRow[] = [
  { id: 'a', weight: '60', weightSource: { value: 60, unit: 'KG' }, reps: '10' },
  { id: 'b', weight: '50', weightSource: { value: 50, unit: 'KG' }, reps: '12' },
  { id: 'c', weight: '', weightSource: null, reps: '8' },
];

describe('Set Tracker bulk apply', () => {
  it('copies only the weight to every set and keeps ids, reps and order', () => {
    const next = applyWeightToAllSets(rows, 'a');
    expect(next.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(next.map((row) => row.weight)).toEqual(['60', '60', '60']);
    expect(next.map((row) => row.reps)).toEqual(['10', '12', '8']);
    expect(next.every((row) => row.weightSource?.value === 60 && row.weightSource.unit === 'KG')).toBe(true);
    // The original draft is not mutated (saved templates are only changed by Save Set Plan).
    expect(rows[1].weight).toBe('50');
    next[1].weightSource!.value = 99;
    expect(next[0].weightSource?.value).toBe(60);
  });

  it('copies only the reps to every set', () => {
    const next = applyRepsToAllSets(rows, 'b');
    expect(next.map((row) => row.reps)).toEqual(['12', '12', '12']);
    expect(next.map((row) => row.weight)).toEqual(['60', '50', '']);
    expect(next.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps KG/LB conversion exact after applying a weight typed in pounds', () => {
    const typedInLb: SetDraftRow[] = [
      { id: 'a', weight: '135', weightSource: { value: 135, unit: 'LB' }, reps: '5' },
      { id: 'b', weight: '61.235', weightSource: { value: 61.235, unit: 'KG' }, reps: '5' },
    ];
    const next = applyWeightToAllSets(typedInLb, 'a');
    // Switching the table to KG derives the text from the copied source, not from rounded text.
    const asKg = next.map((row) => convertWeight(row.weightSource!.value, row.weightSource!.unit, 'KG'));
    expect(asKg[0]).toBe(asKg[1]);
    expect(asKg[0]).toBeCloseTo(61.235, 2);
    expect(next.map((row) => formatNumber(convertWeight(row.weightSource!.value, row.weightSource!.unit, 'LB')))).toEqual(['135', '135']);
  });

  it('offers the action only for a valid value that differs elsewhere', () => {
    expect(canApplyToAllSets(rows, 'a', 'weight')).toBe(true);
    expect(canApplyToAllSets(rows, 'c', 'weight')).toBe(false); // empty
    expect(canApplyToAllSets([{ ...rows[0], weight: 'abc' }, rows[1]], 'a', 'weight')).toBe(false);
    expect(canApplyToAllSets(applyRepsToAllSets(rows, 'a'), 'a', 'reps')).toBe(false); // already equal
    expect(canApplyToAllSets([rows[0]], 'a', 'weight')).toBe(false); // single set
    expect(canApplyToAllSets(rows, 'missing', 'reps')).toBe(false);
  });

  it('returns an unchanged copy when the source row no longer exists', () => {
    expect(applyWeightToAllSets(rows, 'missing')).toEqual(rows);
    expect(applyRepsToAllSets(rows, 'missing')).toEqual(rows);
  });
});
