import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, Save, Trash2, Trophy } from 'lucide-react';
import type {
  DateKey,
  ExercisePreference,
  ExercisePreferenceChanges,
  LibraryExercise,
  WeightUnit,
  WorkoutExerciseLog,
  WorkoutSet,
} from '../../types/gym';
import { formatShortDate, isValidDateKey } from '../../utils/dateUtils';
import { computePersonalRecords } from '../../utils/personalRecords';
import { generateId } from '../../utils/profileUtils';
import {
  convertWeight,
  formatNumber,
  MAX_SETS_PER_SESSION,
  parseNumberInput,
  unitLabel,
  validateSets,
  weightFieldLabel,
} from '../../utils/workoutUtils';
import type { ToastTone } from '../../hooks/useToast';
import { WorkoutSetRow, type DraftSet } from './WorkoutSetRow';

interface WorkoutLoggerProps {
  exercise: LibraryExercise;
  /** Newest first. */
  logs: WorkoutExerciseLog[];
  preference: ExercisePreference;
  todayKey: DateKey;
  date: DateKey;
  onRequestDate: (date: DateKey) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (date: DateKey, sets: WorkoutSet[]) => WorkoutExerciseLog;
  onRequestDelete: (date: DateKey) => void;
  onUpdatePreference: (changes: ExercisePreferenceChanges) => void;
  onToast: (message: string, tone?: ToastTone) => void;
  /** Bumped by the parent to prefill the draft from the previous session. */
  usePreviousSignal: number;
}

const textOf = (value: number | null) => (value === null ? '' : formatNumber(value));

/** Draft weight for a value recorded in `valueUnit`, displayed in `displayUnit`. */
function draftWeight(value: number | null, valueUnit: WeightUnit, displayUnit: WeightUnit): Pick<DraftSet, 'weight' | 'weightSource'> {
  if (value === null) return { weight: '', weightSource: null };
  return { weight: formatNumber(convertWeight(value, valueUnit, displayUnit)), weightSource: { value, unit: valueUnit } };
}

export function WorkoutLogger({
  exercise,
  logs,
  preference,
  todayKey,
  date,
  onRequestDate,
  onDirtyChange,
  onSave,
  onRequestDelete,
  onUpdatePreference,
  onToast,
  usePreviousSignal,
}: WorkoutLoggerProps) {
  const dateId = useId();
  const workingId = useId();
  const hasWeight = weightFieldLabel(exercise) !== null;

  const existing = logs.find((log) => log.date === date) ?? null;
  const previous = logs.find((log) => log.date < date) ?? null;

  const [unit, setUnit] = useState<WeightUnit>(preference.weightUnit);
  const [draft, setDraft] = useState<DraftSet[]>([]);
  const [dirty, setDirtyState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prDate, setPrDate] = useState<DateKey | null>(null);
  /** Working weight shown in the display unit (converted from its own stored unit). */
  const workingDisplay =
    preference.workingWeight === null
      ? null
      : convertWeight(preference.workingWeight, preference.workingWeightUnit, preference.weightUnit);
  const [workingText, setWorkingText] = useState(textOf(workingDisplay));

  const setDirty = (value: boolean) => {
    setDirtyState(value);
    onDirtyChange(value);
  };

  const repsPlaceholders = useMemo(() => {
    const { min, max } = exercise.recommendedRepRange;
    return (index: number) => {
      const previousReps = previous?.sets[index]?.repetitions;
      return previousReps ? String(previousReps) : `${min}–${max}`;
    };
  }, [exercise.recommendedRepRange, previous]);

  /** Fresh draft: the saved session for this date, or a suggestion for a new one. */
  const buildDraft = (): { sets: DraftSet[]; unit: WeightUnit } => {
    if (existing) {
      const sessionUnit = existing.sets[0]?.weightUnit ?? preference.weightUnit;
      return {
        unit: sessionUnit,
        sets: existing.sets.map((set) => ({
          id: set.id,
          ...draftWeight(set.weight, set.weightUnit, sessionUnit),
          reps: set.repetitions === null ? '' : String(set.repetitions),
          completed: set.completed,
        })),
      };
    }
    const sessionUnit = preference.weightUnit;
    const count = previous?.sets.length || exercise.recommendedSets;
    return {
      unit: sessionUnit,
      sets: Array.from({ length: count }, (_, index) => {
        let weight = draftWeight(null, sessionUnit, sessionUnit);
        if (hasWeight && exercise.loadType !== 'BODYWEIGHT') {
          if (preference.workingWeight !== null) weight = draftWeight(preference.workingWeight, preference.workingWeightUnit, sessionUnit);
          else {
            const previousSet = previous?.sets[index];
            if (previousSet?.weight != null) weight = draftWeight(previousSet.weight, previousSet.weightUnit, sessionUnit);
          }
        }
        return { id: generateId(), ...weight, reps: '', completed: false };
      }),
    };
  };

  // Rebuild the draft when the date changes, or when its source data changes and there are no unsaved edits.
  const lastDateRef = useRef<DateKey | null>(null);
  const resetKey = `${date}|${existing?.updatedAt ?? 'new'}|${previous?.id ?? ''}|${preference.workingWeight}|${preference.workingWeightUnit}|${preference.weightUnit}`;
  useEffect(() => {
    const dateChanged = lastDateRef.current !== date;
    lastDateRef.current = date;
    if (!dateChanged && dirty) return;
    const next = buildDraft();
    setDraft(next.sets);
    setUnit(next.unit);
    setError(null);
    if (dateChanged) setPrDate(null);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => setWorkingText(textOf(workingDisplay)), [workingDisplay]);

  // "Use previous session as a starting point" from the parent.
  useEffect(() => {
    if (usePreviousSignal === 0 || !previous) return;
    setDraft(
      previous.sets.map((set) => ({
        id: generateId(),
        ...draftWeight(set.weight, set.weightUnit, unit),
        reps: set.repetitions === null ? '' : String(set.repetitions),
        completed: false,
      })),
    );
    setDirty(true);
    onToast('Previous session copied — tick each set as you complete it', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePreviousSignal]);

  const updateSet = (id: string, changes: Partial<DraftSet>) => {
    const next = { ...changes };
    if (changes.weight !== undefined) {
      const parsed = parseNumberInput(changes.weight);
      next.weightSource = parsed === null ? null : { value: parsed, unit };
    }
    setDraft((sets) => sets.map((set) => (set.id === id ? { ...set, ...next } : set)));
    setDirty(true);
    setError(null);
  };

  const addSet = () => {
    if (draft.length >= MAX_SETS_PER_SESSION) return;
    const last = draft[draft.length - 1];
    let weight = draftWeight(null, unit, unit);
    if (hasWeight && last?.weight) weight = { weight: last.weight, weightSource: last.weightSource };
    else if (hasWeight && preference.workingWeight !== null && exercise.loadType !== 'BODYWEIGHT') {
      weight = draftWeight(preference.workingWeight, preference.workingWeightUnit, unit);
    }
    setDraft((sets) => [...sets, { id: generateId(), ...weight, reps: '', completed: false }]);
    setDirty(true);
  };

  const removeSet = (id: string) => {
    setDraft((sets) => sets.filter((set) => set.id !== id));
    setDirty(true);
  };

  const changeUnit = (next: WeightUnit) => {
    if (next === unit) return;
    setUnit(next);
    setDraft((sets) =>
      sets.map((set) =>
        set.weightSource ? { ...set, weight: formatNumber(convertWeight(set.weightSource.value, set.weightSource.unit, next)) } : set,
      ),
    );
    setDirty(true);
    // Only the display unit changes; the working weight keeps its own unit, so it is never re-converted.
    onUpdatePreference({ weightUnit: next });
  };

  const commitWorkingWeight = () => {
    const parsed = parseNumberInput(workingText);
    if (workingText.trim() !== '' && (parsed === null || parsed < 0 || parsed > 1000)) {
      setError('Working weight must be a number between 0 and 1000.');
      return;
    }
    // Leaving the field untouched must not overwrite the precise stored value with its rounded display.
    if (workingText.trim() === textOf(workingDisplay)) return;
    onUpdatePreference({ workingWeight: parsed, workingWeightUnit: preference.weightUnit });
  };

  const applyWorkingWeight = () => {
    if (preference.workingWeight === null) return;
    const weight = draftWeight(preference.workingWeight, preference.workingWeightUnit, unit);
    setDraft((sets) => sets.map((set) => (set.completed ? set : { ...set, ...weight })));
    setDirty(true);
  };

  const handleDateChange = (value: string) => {
    if (!isValidDateKey(value)) return;
    if (value > todayKey) {
      setError('Workouts can’t be logged for future dates.');
      return;
    }
    onRequestDate(value);
  };

  const handleSave = () => {
    const sets: WorkoutSet[] = [];
    for (const [index, row] of draft.entries()) {
      const parsedWeight = hasWeight ? parseNumberInput(row.weight) : null;
      if (hasWeight && row.weight.trim() !== '' && parsedWeight === null) {
        setError(`Set ${index + 1}: weight must be a number.`);
        return;
      }
      const reps = parseNumberInput(row.reps);
      if (row.reps.trim() !== '' && (reps === null || !Number.isInteger(reps))) {
        setError(`Set ${index + 1}: ${exercise.measure === 'SECONDS' ? 'seconds' : 'reps'} must be a whole number.`);
        return;
      }
      const weight =
        hasWeight && row.weightSource ? convertWeight(row.weightSource.value, row.weightSource.unit, unit) : parsedWeight;
      sets.push({ id: row.id, setNumber: index + 1, weight, weightUnit: unit, repetitions: reps, completed: row.completed });
    }
    const validationError = validateSets(sets, exercise);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const saved = onSave(date, sets);
      const updatedLogs = [saved, ...logs.filter((log) => log.date !== date)];
      const records = computePersonalRecords(updatedLogs, exercise);
      const isNewPr = records.prSessionDates.has(date);

      // Keep the working weight current when this is the latest session.
      const isLatest = updatedLogs.every((log) => log.date <= date);
      const completedWeights = sets.filter((set) => set.completed && set.weight !== null).map((set) => set.weight as number);
      if (exercise.loadType === 'WEIGHTED' && isLatest && completedWeights.length > 0) {
        const top = Math.max(...completedWeights);
        onUpdatePreference({ workingWeight: top, workingWeightUnit: unit });
      }

      setDirty(false);
      setError(null);
      setPrDate(isNewPr ? date : null);
      onToast(isNewPr ? 'New personal record! Workout saved.' : existing ? 'Workout updated' : 'Workout saved', 'success');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this workout.');
    }
  };

  const completedCount = draft.filter((set) => set.completed).length;
  const weightText = weightFieldLabel(exercise);

  return (
    <section className="detail-card logger" aria-labelledby="logger-heading" data-testid="logger">
      <div className="logger__header">
        <h2 id="logger-heading" className="logger__title">
          <ClipboardList size={18} aria-hidden="true" /> Log workout
        </h2>
        <span className="logger__status" data-testid="logger-status">
          {existing ? `Saved session · ${formatShortDate(date)}` : 'New session'}
          {dirty && <span className="logger__unsaved"> · unsaved changes</span>}
        </span>
      </div>

      {prDate === date && (
        <p className="pr-banner" role="status" data-testid="pr-banner">
          <Trophy size={18} aria-hidden="true" /> New personal record in this session!
        </p>
      )}

      <div className="logger__controls">
        <label className="logger__control" htmlFor={dateId}>
          <span className="field__label">Date</span>
          <input
            id={dateId}
            className="field__input logger__date"
            type="date"
            value={date}
            max={todayKey}
            onChange={(event) => handleDateChange(event.target.value)}
            data-testid="logger-date"
          />
        </label>
        {hasWeight && (
          <div className="logger__control">
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
      </div>

      {exercise.loadType === 'WEIGHTED' && (
        <div className="logger__working">
          <label htmlFor={workingId} className="field__label">
            Current working weight ({unitLabel(preference.weightUnit)})
          </label>
          <div className="logger__working-row">
            <input
              id={workingId}
              className="field__input"
              type="text"
              inputMode="decimal"
              placeholder="Not set"
              value={workingText}
              onChange={(event) => setWorkingText(event.target.value)}
              onBlur={commitWorkingWeight}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitWorkingWeight();
                }
              }}
              data-testid="working-weight"
            />
            <button type="button" className="button button--ghost button--compact" onClick={applyWorkingWeight} disabled={preference.workingWeight === null}>
              Apply to sets
            </button>
          </div>
        </div>
      )}

      <div className={`set-table${hasWeight ? '' : ' set-table--no-weight'}`}>
        <div className="set-row set-row--head" aria-hidden="true">
          <span>Set</span>
          {weightText && (
            <span>
              {weightText} ({unitLabel(unit)})
            </span>
          )}
          <span>{exercise.measure === 'SECONDS' ? 'Secs' : 'Reps'}</span>
          <span>Done</span>
          <span />
        </div>
        <ol className="set-table__rows">
          {draft.map((set, index) => (
            <WorkoutSetRow
              key={set.id}
              index={index}
              set={set}
              exercise={exercise}
              unitText={unitLabel(unit)}
              repsPlaceholder={repsPlaceholders(index)}
              canRemove={draft.length > 1}
              onChange={updateSet}
              onRemove={removeSet}
            />
          ))}
        </ol>
      </div>

      <button type="button" className="button button--ghost logger__add" onClick={addSet} disabled={draft.length >= MAX_SETS_PER_SESSION}>
        <Plus size={18} aria-hidden="true" /> Add Set
      </button>

      {error && (
        <p className="field__error logger__error" role="alert">
          {error}
        </p>
      )}

      <div className="logger__footer">
        <span className="logger__summary">
          {completedCount}/{draft.length} sets completed
        </span>
        <button type="button" className="button button--primary logger__save" onClick={handleSave} data-testid="save-workout">
          <Save size={18} aria-hidden="true" /> {existing ? 'Save changes' : 'Save Workout'}
        </button>
      </div>
      {existing && (
        <button type="button" className="button button--ghost button--compact button--danger-text logger__delete" onClick={() => onRequestDelete(date)}>
          <Trash2 size={16} aria-hidden="true" /> Delete this session
        </button>
      )}
      <p className="logger__hint">Sets are only marked completed when you tick them. Recommended sets and reps are general starting suggestions.</p>
    </section>
  );
}
