import type { WeightUnit } from '../types/gym';
import { parseNumberInput } from './workoutUtils';

/** One editable row of the Set Tracker (unsaved draft of the reusable set plan). */
export interface SetDraftRow {
  id: string;
  /** Text shown in the weight input. */
  weight: string;
  /** Value + unit as typed or loaded; display text is derived from it (no double conversion). */
  weightSource: { value: number; unit: WeightUnit } | null;
  /** Text shown in the reps / seconds input. */
  reps: string;
}

export type SetDraftField = 'weight' | 'reps';

/**
 * Copies ONLY the weight of `sourceRowId` to every row. Row ids, reps, order and
 * row count are untouched, so completion ticks (stored by index) and PRs are unaffected.
 * The source's `weightSource` is copied as-is, so KG/LB conversion stays exact.
 */
export function applyWeightToAllSets(rows: readonly SetDraftRow[], sourceRowId: string): SetDraftRow[] {
  const source = rows.find((row) => row.id === sourceRowId);
  if (!source) return [...rows];
  return rows.map((row) => ({ ...row, weight: source.weight, weightSource: source.weightSource ? { ...source.weightSource } : null }));
}

/** Copies ONLY the reps (or seconds) of `sourceRowId` to every row. */
export function applyRepsToAllSets(rows: readonly SetDraftRow[], sourceRowId: string): SetDraftRow[] {
  const source = rows.find((row) => row.id === sourceRowId);
  if (!source) return [...rows];
  return rows.map((row) => ({ ...row, reps: source.reps }));
}

/** The bulk action is offered only for a valid, non-empty value that differs on at least one other row. */
export function canApplyToAllSets(rows: readonly SetDraftRow[], sourceRowId: string, field: SetDraftField): boolean {
  const source = rows.find((row) => row.id === sourceRowId);
  if (!source || rows.length < 2) return false;
  const text = field === 'weight' ? source.weight : source.reps;
  if (text.trim() === '' || parseNumberInput(text) === null) return false;
  return rows.some((row) => (field === 'weight' ? row.weight !== source.weight : row.reps !== source.reps));
}
