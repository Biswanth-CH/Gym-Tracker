import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardCheck, CopyCheck, Loader2, Plus, Save, Trash2, Trophy, Undo2 } from 'lucide-react';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { validateSetPlan } from '../../services/cloud/trackingServices';
import type { LibraryExercise, PersonalRecord, SetPlan, SetTemplate, WeightUnit } from '../../types/gym';
import { generateId } from '../../utils/profileUtils';
import { applyRepsToAllSets, applyWeightToAllSets, canApplyToAllSets, type SetDraftField, type SetDraftRow } from '../../utils/setPlanDraft';
import { beatsRecord, type PrCandidate } from '../../utils/prUtils';
import { convertWeight, formatNumber, formatSet, MAX_SETS_PER_SESSION, parseNumberInput, unitLabel, weightFieldLabel } from '../../utils/workoutUtils';
import type { ToastTone } from '../../hooks/useToast';

/**
 * Set Tracker
 *  - The SET PLAN (sets, weight, reps, unit) is reusable: saved explicitly with
 *    "Save Set Plan", per profile + exercise, synced across devices.
 *  - The DONE checkboxes are a temporary per-day tracker: saved automatically
 *    for today's local date; a new date starts unchecked. No history is kept.
 */

type DraftRow = SetDraftRow;

interface SetTrackerProps {
  exercise: LibraryExercise;
  template: SetTemplate | null;
  completed: ReadonlySet<number>;
  record: PersonalRecord | null;
  onSavePlan: (plan: SetPlan) => Promise<void>;
  onSetCompleted: (indexes: number[]) => Promise<void>;
  onAcceptPr: (candidate: PrCandidate) => Promise<void>;
  onToast: (message: string, tone?: ToastTone) => void;
}

export const DEFAULT_SET_COUNT = 3;
export const DEFAULT_REPS = 12;

export function defaultPlan(exercise: LibraryExercise): SetPlan {
  const reps = exercise.measure === 'SECONDS' ? exercise.recommendedRepRange.max : DEFAULT_REPS;
  return { unit: 'KG', sets: Array.from({ length: DEFAULT_SET_COUNT }, () => ({ weight: null, reps })) };
}

function rowsFromPlan(plan: SetPlan): DraftRow[] {
  return plan.sets.map((set) => ({
    id: generateId(),
    weight: set.weight === null ? '' : formatNumber(set.weight),
    weightSource: set.weight === null ? null : { value: set.weight, unit: plan.unit },
    reps: String(set.reps),
  }));
}

export function SetTracker({ exercise, template, completed, record, onSavePlan, onSetCompleted, onAcceptPr, onToast }: SetTrackerProps) {
  const weightLabel = weightFieldLabel(exercise);
  const hasWeight = weightLabel !== null;
  const amountLabel = exercise.measure === 'SECONDS' ? 'Secs' : 'Reps';
  const savedPlan = template?.plan ?? defaultPlan(exercise);

  const [unit, setUnit] = useState<WeightUnit>(savedPlan.unit);
  const [rows, setRows] = useState<DraftRow[]>(() => rowsFromPlan(savedPlan));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<ReadonlySet<number> | null>(null);
  const [suggestion, setSuggestion] = useState<PrCandidate | null>(null);
  const [acceptingPr, setAcceptingPr] = useState(false);
  /** The input the user is editing; drives the "Apply … to All Sets" action. */
  const [editingField, setEditingField] = useState<{ rowId: string; field: SetDraftField } | null>(null);

  // Adopt the saved plan when it loads or changes on another device — unless there are unsaved edits.
  const templateKey = template ? `${template.id}:${template.updatedAt}` : 'default';
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    setUnit(savedPlan.unit);
    setRows(rowsFromPlan(savedPlan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  const done = optimistic ?? completed;
  const doneCount = rows.filter((_, index) => done.has(index)).length;

  const parsedRows = useMemo(
    () =>
      rows.map((row) => ({
        weight: hasWeight ? (row.weightSource ? convertWeight(row.weightSource.value, row.weightSource.unit, unit) : parseNumberInput(row.weight)) : null,
        reps: parseNumberInput(row.reps),
      })),
    [rows, unit, hasWeight],
  );

  const edit = (id: string, changes: Partial<Pick<DraftRow, 'weight' | 'reps'>>) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...changes };
        if (changes.weight !== undefined) {
          const parsed = parseNumberInput(changes.weight);
          next.weightSource = parsed === null ? null : { value: parsed, unit };
        }
        return next;
      }),
    );
    setDirty(true);
    setError(null);
  };

  const changeUnit = (next: WeightUnit) => {
    if (next === unit) return;
    setUnit(next);
    setRows((current) => current.map((row) => (row.weightSource ? { ...row, weight: formatNumber(convertWeight(row.weightSource.value, row.weightSource.unit, next)) } : row)));
    setDirty(true);
  };

  const addSet = () => {
    if (rows.length >= MAX_SETS_PER_SESSION) return;
    const last = rows[rows.length - 1];
    setRows((current) => [
      ...current,
      { id: generateId(), weight: last?.weight ?? '', weightSource: last?.weightSource ?? null, reps: last?.reps ?? String(DEFAULT_REPS) },
    ]);
    setDirty(true);
  };

  /**
   * Bulk edit of the DRAFT only: never ticks or unticks sets, never touches PRs,
   * keeps row ids, and is not saved until the user taps Save Set Plan.
   */
  const applyToAllSets = (field: SetDraftField) => {
    if (!editingField) return;
    setRows((current) => (field === 'weight' ? applyWeightToAllSets(current, editingField.rowId) : applyRepsToAllSets(current, editingField.rowId)));
    setDirty(true);
    setError(null);
    onToast(field === 'weight' ? 'Weight applied to all sets. Save Set Plan to keep it.' : `${amountLabel} applied to all sets. Save Set Plan to keep it.`, 'info');
  };

  const editingRowIndex = editingField ? rows.findIndex((row) => row.id === editingField.rowId) : -1;
  const showApplyAction = editingField !== null && editingRowIndex >= 0 && canApplyToAllSets(rows, editingField.rowId, editingField.field);

  const removeSet = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    setDirty(true);
  };

  const discard = () => {
    setUnit(savedPlan.unit);
    setRows(rowsFromPlan(savedPlan));
    setDirty(false);
    setError(null);
  };

  const savePlan = async () => {
    for (const [index, row] of rows.entries()) {
      if (hasWeight && row.weight.trim() !== '' && parseNumberInput(row.weight) === null) return setError(`Set ${index + 1}: weight must be a number.`);
    }
    const plan: SetPlan = {
      unit,
      sets: parsedRows.map((row) => ({ weight: row.weight === null ? null : Math.round(row.weight * 1e6) / 1e6, reps: row.reps ?? NaN })),
    };
    const problem = validateSetPlan(plan, exercise.measure);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await onSavePlan(plan);
      setDirty(false);
      setError(null);
      onToast('Set plan saved — it will be ready next time on any device');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the set plan.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (index: number) => {
    const next = new Set(done);
    const checking = !next.has(index);
    if (checking) next.add(index);
    else next.delete(index);
    setOptimistic(next);
    try {
      await onSetCompleted([...next].filter((i) => i < rows.length));
    } catch (toggleError) {
      onToast(errorMessage(toggleError, 'Could not save your progress.'), 'error');
    } finally {
      setOptimistic(null);
    }
    // Only a COMPLETED set can suggest a new PR.
    if (checking) {
      const values = parsedRows[index];
      const candidate: PrCandidate = { weight: values.weight, unit, reps: values.reps ?? 0 };
      if (beatsRecord(candidate, record, exercise)) setSuggestion(candidate);
    }
  };

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    setAcceptingPr(true);
    try {
      await onAcceptPr(suggestion);
      setSuggestion(null);
    } catch (prError) {
      onToast(errorMessage(prError, 'Could not update the PR.'), 'error');
    } finally {
      setAcceptingPr(false);
    }
  };

  return (
    <section className="detail-card logger set-tracker" aria-labelledby="set-tracker-heading" data-testid="set-tracker">
      <div className="logger__header">
        <h2 id="set-tracker-heading" className="logger__title">
          <ClipboardCheck size={18} aria-hidden="true" /> Set Tracker
        </h2>
        <span className="logger__status" data-testid="tracker-status">
          Today: {doneCount}/{rows.length} sets done
          {dirty && <span className="logger__unsaved"> · plan not saved</span>}
        </span>
      </div>
      <p className="logger__hint set-tracker__hint">Tick sets as you finish them — ticks reset tomorrow. Your weights and reps stay saved.</p>

      {hasWeight && (
        <div className="set-tracker__unit">
          <span className="field__label">Unit</span>
          <div className="segmented" role="group" aria-label="Weight unit">
            {(['KG', 'LB'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented__option${unit === option ? ' is-active' : ''}`}
                aria-pressed={unit === option}
                onClick={() => changeUnit(option)}
              >
                {unitLabel(option)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`set-table${hasWeight ? '' : ' set-table--no-weight'}`}>
        <div className="set-row set-row--head" aria-hidden="true">
          <span>Set</span>
          {weightLabel && (
            <span>
              {weightLabel} ({unitLabel(unit)})
            </span>
          )}
          <span>{amountLabel}</span>
          <span>Done</span>
          <span />
        </div>
        <ol className="set-table__rows">
          {rows.map((row, index) => {
            const isDone = done.has(index);
            return (
              <li key={row.id} className={`set-row${isDone ? ' is-completed' : ''}`} data-testid="set-row">
                <span className="set-row__number" aria-hidden="true">
                  {index + 1}
                </span>
                {weightLabel && (
                  <label className="set-row__field">
                    <span className="visually-hidden">
                      Set {index + 1} {weightLabel.toLowerCase()} in {unitLabel(unit)}
                    </span>
                    <input
                      className="set-row__input"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.weight}
                      placeholder={exercise.loadType === 'BODYWEIGHT' ? '0' : '—'}
                      onChange={(event) => edit(row.id, { weight: event.target.value })}
                      onFocus={() => setEditingField({ rowId: row.id, field: 'weight' })}
                      data-testid="set-weight"
                    />
                  </label>
                )}
                <label className="set-row__field">
                  <span className="visually-hidden">
                    Set {index + 1} {amountLabel.toLowerCase()}
                  </span>
                  <input
                    className="set-row__input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={row.reps}
                    onChange={(event) => edit(row.id, { reps: event.target.value })}
                    onFocus={() => setEditingField({ rowId: row.id, field: 'reps' })}
                    data-testid="set-reps"
                  />
                </label>
                <button
                  type="button"
                  className={`set-row__done${isDone ? ' is-active' : ''}`}
                  onClick={() => void toggleDone(index)}
                  aria-pressed={isDone}
                  aria-label={`Set ${index + 1} done today`}
                  data-testid="set-done"
                >
                  <Check size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger set-row__remove"
                  onClick={() => removeSet(row.id)}
                  disabled={rows.length <= 1}
                  aria-label={`Remove set ${index + 1}`}
                  data-testid="set-remove"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {showApplyAction && editingField && (
        <div className="set-apply" data-testid="set-apply">
          <span className="set-apply__label">
            Set {editingRowIndex + 1}:{' '}
            {editingField.field === 'weight'
              ? `${rows[editingRowIndex].weight} ${unitLabel(unit)}`
              : `${rows[editingRowIndex].reps} ${amountLabel.toLowerCase()}`}
          </span>
          <button
            type="button"
            className="button button--ghost button--compact set-apply__button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyToAllSets(editingField.field)}
            data-testid={editingField.field === 'weight' ? 'apply-weight-all' : 'apply-reps-all'}
          >
            <CopyCheck size={16} aria-hidden="true" />
            {editingField.field === 'weight' ? 'Apply Weight to All Sets' : `Apply ${amountLabel} to All Sets`}
          </button>
        </div>
      )}

      <button type="button" className="button button--ghost logger__add" onClick={addSet} disabled={rows.length >= MAX_SETS_PER_SESSION}>
        <Plus size={18} aria-hidden="true" /> Add Set
      </button>

      {suggestion && (
        <div className="pr-suggestion" role="status" data-testid="pr-suggestion">
          <Trophy size={18} aria-hidden="true" />
          <span>
            <strong>{formatSet({ weight: suggestion.weight, weightUnit: suggestion.unit, repetitions: suggestion.reps }, exercise)}</strong>{' '}
            {record ? 'beats your current PR. Update it?' : 'could be your first PR. Save it?'}
          </span>
          <div className="pr-suggestion__actions">
            <button type="button" className="button button--ghost button--compact" onClick={() => setSuggestion(null)} disabled={acceptingPr}>
              Ignore
            </button>
            <button type="button" className="button button--primary button--compact" onClick={() => void acceptSuggestion()} disabled={acceptingPr} data-testid="pr-accept">
              {acceptingPr ? 'Saving…' : 'Update PR'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="field__error logger__error" role="alert">
          {error}
        </p>
      )}

      <div className="logger__footer">
        {dirty && (
          <button type="button" className="button button--ghost button--compact" onClick={discard} disabled={saving}>
            <Undo2 size={16} aria-hidden="true" /> Discard
          </button>
        )}
        <button type="button" className="button button--primary logger__save" onClick={() => void savePlan()} disabled={saving || (!dirty && template !== null)} data-testid="save-plan">
          {saving ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save Set Plan'}
        </button>
      </div>
    </section>
  );
}
