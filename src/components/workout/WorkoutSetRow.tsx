import { Check, Trash2 } from 'lucide-react';
import type { LibraryExercise, WeightUnit } from '../../types/gym';
import { weightFieldLabel } from '../../utils/workoutUtils';

/**
 * Editable set while logging. Numbers stay as text until save, so typing "42." works.
 * `source` is the weight exactly as entered or loaded, in its ORIGINAL unit. The
 * displayed text is always derived from it, so switching kg ↔ lb never converts a
 * rounded, already-converted number (kg → lb → kg returns the original value).
 */
export interface DraftSet {
  id: string;
  weight: string;
  weightSource: { value: number; unit: WeightUnit } | null;
  reps: string;
  completed: boolean;
}

interface WorkoutSetRowProps {
  index: number;
  set: DraftSet;
  exercise: LibraryExercise;
  unitText: string;
  repsPlaceholder: string;
  canRemove: boolean;
  onChange: (id: string, changes: Partial<DraftSet>) => void;
  onRemove: (id: string) => void;
}

export function WorkoutSetRow({ index, set, exercise, unitText, repsPlaceholder, canRemove, onChange, onRemove }: WorkoutSetRowProps) {
  const weightLabel = weightFieldLabel(exercise);
  const amountLabel = exercise.measure === 'SECONDS' ? 'Seconds' : 'Reps';
  const setLabel = `Set ${index + 1}`;

  return (
    <li className={`set-row${set.completed ? ' is-completed' : ''}${weightLabel ? '' : ' set-row--no-weight'}`} data-testid="set-row">
      <span className="set-row__number" aria-hidden="true">
        {index + 1}
      </span>
      {weightLabel && (
        <label className="set-row__field">
          <span className="visually-hidden">
            {setLabel} {weightLabel.toLowerCase()} in {unitText}
          </span>
          <input
            className="set-row__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={set.weight}
            placeholder={exercise.loadType === 'BODYWEIGHT' ? '0' : '—'}
            onChange={(event) => onChange(set.id, { weight: event.target.value })}
            data-testid="set-weight"
          />
        </label>
      )}
      <label className="set-row__field">
        <span className="visually-hidden">
          {setLabel} {amountLabel.toLowerCase()}
        </span>
        <input
          className="set-row__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={set.reps}
          placeholder={repsPlaceholder}
          onChange={(event) => onChange(set.id, { reps: event.target.value })}
          data-testid="set-reps"
        />
      </label>
      <button
        type="button"
        className={`set-row__done${set.completed ? ' is-active' : ''}`}
        onClick={() => onChange(set.id, { completed: !set.completed })}
        aria-pressed={set.completed}
        aria-label={`${setLabel} completed`}
        data-testid="set-done"
      >
        <Check size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button icon-button--danger set-row__remove"
        onClick={() => onRemove(set.id)}
        disabled={!canRemove}
        aria-label={`Remove ${setLabel.toLowerCase()}`}
        data-testid="set-remove"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
