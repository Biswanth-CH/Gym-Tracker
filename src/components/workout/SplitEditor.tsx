import { useEffect, useId, useState } from 'react';
import { MUSCLE_GROUPS } from '../../constants/muscleGroups';
import { WEEKLY_SCHEDULE } from '../../constants/workoutSchedule';
import { errorMessage } from '../../services/cloud/cloudErrors';
import type { CustomDayPlan, MuscleGroupId } from '../../types/gym';
import { SPLIT_NAME_MAX_LENGTH, validateCustomSchedule } from '../../utils/workoutPlan';
import { Modal } from '../Modal';

interface SplitEditorProps {
  isOpen: boolean;
  splitName: string;
  days: readonly CustomDayPlan[];
  onClose: () => void;
  onSave: (splitName: string, days: CustomDayPlan[]) => Promise<void>;
}

export function SplitEditor({ isOpen, splitName, days, onClose, onSave }: SplitEditorProps) {
  const nameId = useId();
  const [name, setName] = useState(splitName);
  const [draft, setDraft] = useState<CustomDayPlan[]>(() => days.map((day) => ({ ...day, muscleGroupIds: [...day.muscleGroupIds] })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(splitName);
    setDraft(days.map((day) => ({ ...day, muscleGroupIds: [...day.muscleGroupIds] })));
    setError(null);
    setSaving(false);
  }, [isOpen, splitName, days]);

  const updateDay = (dayId: CustomDayPlan['dayId'], patch: Partial<CustomDayPlan>) => {
    setDraft((current) => current.map((day) => (day.dayId === dayId ? { ...day, ...patch } : day)));
    setError(null);
  };

  const toggleMuscle = (dayId: CustomDayPlan['dayId'], muscleId: MuscleGroupId) => {
    setDraft((current) =>
      current.map((day) => {
        if (day.dayId !== dayId || day.isRest) return day;
        const selected = day.muscleGroupIds.includes(muscleId);
        return {
          ...day,
          muscleGroupIds: selected ? day.muscleGroupIds.filter((id) => id !== muscleId) : [...day.muscleGroupIds, muscleId],
        };
      }),
    );
    setError(null);
  };

  const save = async () => {
    const cleaned = draft.map((day) => ({
      ...day,
      workoutName: day.isRest ? day.workoutName.trim() || 'Rest' : day.workoutName.trim(),
      muscleGroupIds: day.isRest ? [] : day.muscleGroupIds,
    }));
    const problem = validateCustomSchedule(name, cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), cleaned);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the split.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit split" description="Choose a name and the muscles for each day. Rest days train nothing." placement="top">
      <div className="form split-editor">
        <div className="field">
          <label className="field__label" htmlFor={nameId}>
            Split name
          </label>
          <input id={nameId} className="field__input" value={name} maxLength={SPLIT_NAME_MAX_LENGTH} onChange={(event) => setName(event.target.value)} />
        </div>
        {WEEKLY_SCHEDULE.map((meta) => {
          const day = draft.find((candidate) => candidate.dayId === meta.id);
          if (!day) return null;
          const nameFieldId = `${nameId}-${meta.id}`;
          return (
            <fieldset key={meta.id} className="split-day">
              <legend className="split-day__legend">{meta.dayName}</legend>
              <label className="split-day__rest">
                <input
                  type="checkbox"
                  checked={day.isRest}
                  onChange={(event) => updateDay(day.dayId, { isRest: event.target.checked, muscleGroupIds: event.target.checked ? [] : day.muscleGroupIds })}
                />
                Rest day
              </label>
              <label className="field__label" htmlFor={nameFieldId}>
                Workout name
              </label>
              <input
                id={nameFieldId}
                className="field__input"
                value={day.workoutName}
                maxLength={SPLIT_NAME_MAX_LENGTH}
                disabled={day.isRest}
                onChange={(event) => updateDay(day.dayId, { workoutName: event.target.value })}
              />
              <div className="split-day__muscles" role="group" aria-label={`${meta.dayName} muscle groups`}>
                {MUSCLE_GROUPS.map((group) => {
                  const selected = day.muscleGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`split-chip${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      disabled={day.isRest}
                      onClick={() => toggleMuscle(day.dayId, group.id)}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
