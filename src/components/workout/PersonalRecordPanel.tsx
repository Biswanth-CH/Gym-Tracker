import { useEffect, useId, useState } from 'react';
import { CalendarDays, Loader2, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { validatePersonalRecord } from '../../services/cloud/trackingServices';
import type { LibraryExercise, PersonalRecord, PersonalRecordInput, WeightUnit } from '../../types/gym';
import { formatShortDate, toDateKey } from '../../utils/dateUtils';
import { convertWeight, formatNumber, parseNumberInput, unitLabel, weightFieldLabel } from '../../utils/workoutUtils';
import { ConfirmDialog } from '../ConfirmDialog';
import { Modal } from '../Modal';

interface PersonalRecordPanelProps {
  exercise: LibraryExercise;
  record: PersonalRecord | null;
  onSave: (input: PersonalRecordInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  /** Hide the large summary card and keep only the editor modal. */
  hideSummary?: boolean;
  /** Increment to open the editor from an external button. */
  openRequest?: number;
}

const otherUnit = (unit: WeightUnit): WeightUnit => (unit === 'KG' ? 'LB' : 'KG');

/** Manual PR per profile + exercise variation — independent of the daily Set Tracker. */
export function PersonalRecordPanel({ exercise, record, onSave, onDelete, onToast, hideSummary = false, openRequest = 0 }: PersonalRecordPanelProps) {
  const [editing, setEditing] = useState(false);
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    if (openRequest > 0) setEditing(true);
  }
  const weightLabel = weightFieldLabel(exercise);
  const amountWord = exercise.measure === 'SECONDS' ? 'seconds' : 'reps';

  const modal = (
      <PersonalRecordModal
        isOpen={editing}
        exercise={exercise}
        record={record}
        onClose={() => setEditing(false)}
        onSave={async (input) => {
          await onSave(input);
          setEditing(false);
          onToast(record ? 'Personal record updated' : 'Personal record saved');
        }}
        onDelete={async () => {
          await onDelete();
          setEditing(false);
          onToast('Personal record deleted', 'info');
        }}
      />
    );

  if (hideSummary) return modal;

  return (
    <section className="detail-card pr-panel" aria-labelledby="pr-heading" data-testid="pr-panel">
      <div className="pr-panel__header">
        <h2 id="pr-heading" className="detail-card__title pr-card__title">
          <Trophy size={16} aria-hidden="true" /> Personal Record
        </h2>
        {record && (
          <button type="button" className="button button--ghost button--compact" onClick={() => setEditing(true)} data-testid="pr-edit">
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      {record ? (
        <div className="pr-panel__body" data-testid="pr-value">
          <p className="pr-panel__main">
            {weightLabel && record.weight !== null ? (
              <>
                <strong>
                  {exercise.loadType === 'ASSISTED' ? 'Assist ' : exercise.loadType === 'BODYWEIGHT' ? 'BW + ' : ''}
                  {formatNumber(record.weight)} {unitLabel(record.unit)}
                </strong>
                <span className="pr-panel__times"> × </span>
              </>
            ) : null}
            <strong>
              {record.reps} {amountWord}
            </strong>
          </p>
          {weightLabel && record.weight !== null && (
            <p className="pr-panel__conversion">
              ≈ {formatNumber(convertWeight(record.weight, record.unit, otherUnit(record.unit)))} {unitLabel(otherUnit(record.unit))}
            </p>
          )}
          <dl className="pr-panel__meta">
            {record.sets !== null && (
              <div>
                <dt>Sets</dt>
                <dd>{record.sets}</dd>
              </div>
            )}
            <div>
              <dt>Achieved</dt>
              <dd>
                <CalendarDays size={14} aria-hidden="true" /> {formatShortDate(record.recordDate)}
              </dd>
            </div>
          </dl>
          {record.notes && <p className="pr-panel__notes">{record.notes}</p>}
        </div>
      ) : (
        <div className="pr-panel__empty">
          <p className="pr-panel__empty-title">No Personal Record Yet</p>
          <button type="button" className="button button--primary" onClick={() => setEditing(true)} data-testid="pr-add">
            <Plus size={18} aria-hidden="true" /> Add Your New PR
          </button>
        </div>
      )}

      {modal}
    </section>
  );
}

interface PersonalRecordModalProps {
  isOpen: boolean;
  exercise: LibraryExercise;
  record: PersonalRecord | null;
  onClose: () => void;
  onSave: (input: PersonalRecordInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

function PersonalRecordModal({ isOpen, exercise, record, onClose, onSave, onDelete }: PersonalRecordModalProps) {
  const ids = { weight: useId(), reps: useId(), date: useId(), sets: useId(), notes: useId() };
  const weightLabel = weightFieldLabel(exercise);
  const today = toDateKey(new Date());
  const [unit, setUnit] = useState<WeightUnit>('KG');
  const [weightText, setWeightText] = useState('');
  const [weightSource, setWeightSource] = useState<{ value: number; unit: WeightUnit } | null>(null);
  const [repsText, setRepsText] = useState('');
  const [date, setDate] = useState(today);
  const [setsText, setSetsText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUnit(record?.unit ?? 'KG');
    setWeightText(record?.weight != null ? formatNumber(record.weight) : '');
    setWeightSource(record?.weight != null ? { value: record.weight, unit: record.unit } : null);
    setRepsText(record ? String(record.reps) : '');
    setDate(record?.recordDate ?? toDateKey(new Date()));
    setSetsText(record?.sets != null ? String(record.sets) : '');
    setNotes(record?.notes ?? '');
    setError(null);
    setSaving(false);
  }, [isOpen, record]);

  const changeUnit = (next: WeightUnit) => {
    if (next === unit) return;
    setUnit(next);
    if (weightSource) setWeightText(formatNumber(convertWeight(weightSource.value, weightSource.unit, next)));
  };

  const submit = async () => {
    if (weightLabel && weightText.trim() !== '' && parseNumberInput(weightText) === null) return setError('Weight must be a number.');
    const weight = weightLabel ? (weightSource ? convertWeight(weightSource.value, weightSource.unit, unit) : null) : null;
    const reps = parseNumberInput(repsText);
    const sets = setsText.trim() === '' ? null : parseNumberInput(setsText);
    const input: PersonalRecordInput = {
      recordDate: date,
      weight,
      unit,
      reps: reps ?? NaN,
      sets: sets === null ? null : sets,
      notes: notes.trim() ? notes.trim() : null,
    };
    const problem = validatePersonalRecord(input, exercise.measure, exercise.loadType === 'WEIGHTED' || exercise.loadType === 'ASSISTED');
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await onSave(input);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the personal record.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !confirmDelete}
        onClose={onClose}
        placement="top"
        title={record ? 'Edit personal record' : 'Add your new PR'}
        description={exercise.name}
        icon={<Trophy size={24} aria-hidden="true" />}
      >
        <form
          className="form pr-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          {weightLabel && (
            <div className="pr-form__row">
              <div className="field">
                <label htmlFor={ids.weight} className="field__label">
                  {weightLabel === 'Assist' ? 'Assistance' : weightLabel === 'Added' ? 'Added weight' : 'Weight'}
                </label>
                <input
                  id={ids.weight}
                  className="field__input"
                  type="text"
                  inputMode="decimal"
                  data-autofocus
                  value={weightText}
                  onChange={(event) => {
                    setWeightText(event.target.value);
                    const parsed = parseNumberInput(event.target.value);
                    setWeightSource(parsed === null ? null : { value: parsed, unit });
                  }}
                  data-testid="pr-weight"
                />
              </div>
              <div className="field">
                <span className="field__label">Unit</span>
                <div className="segmented" role="group" aria-label="PR weight unit">
                  {(['KG', 'LB'] as const).map((option) => (
                    <button key={option} type="button" className={`segmented__option${unit === option ? ' is-active' : ''}`} aria-pressed={unit === option} onClick={() => changeUnit(option)}>
                      {unitLabel(option)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="pr-form__row">
            <div className="field">
              <label htmlFor={ids.reps} className="field__label">
                {exercise.measure === 'SECONDS' ? 'Seconds' : 'Repetitions'}
              </label>
              <input id={ids.reps} className="field__input" type="text" inputMode="numeric" value={repsText} onChange={(event) => setRepsText(event.target.value)} data-testid="pr-reps" />
            </div>
            <div className="field">
              <label htmlFor={ids.sets} className="field__label">
                Sets (optional)
              </label>
              <input id={ids.sets} className="field__input" type="text" inputMode="numeric" value={setsText} onChange={(event) => setSetsText(event.target.value)} data-testid="pr-sets" />
            </div>
          </div>
          <div className="field">
            <label htmlFor={ids.date} className="field__label">
              Date achieved
            </label>
            <input id={ids.date} className="field__input" type="date" max={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} data-testid="pr-date" />
          </div>
          <div className="field">
            <label htmlFor={ids.notes} className="field__label">
              Notes (optional)
            </label>
            <textarea id={ids.notes} className="field__input field__textarea" rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="pr-notes" />
          </div>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={saving} data-testid="pr-save">
              {saving && <Loader2 size={18} className="spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save PR'}
            </button>
          </div>
          {record && (
            <button type="button" className="button button--ghost button--compact button--danger-text pr-form__delete" onClick={() => setConfirmDelete(true)} disabled={saving} data-testid="pr-delete">
              <Trash2 size={16} aria-hidden="true" /> Delete PR
            </button>
          )}
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this personal record?"
        description={`Your PR for ${exercise.name} will be removed on all your devices.`}
        confirmLabel="Delete PR"
        destructive
        icon={<Trash2 size={24} aria-hidden="true" />}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await onDelete();
          } catch (deleteError) {
            setError(errorMessage(deleteError, 'Could not delete the personal record.'));
          } finally {
            setConfirmDelete(false);
          }
        }}
      />
    </>
  );
}
