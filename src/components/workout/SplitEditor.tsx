import { useEffect, useId, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, Search } from 'lucide-react';
import { EXERCISES_BY_ID } from '../../constants/exerciseLibrary';
import { MUSCLE_GROUPS, MUSCLE_GROUPS_BY_ID } from '../../constants/muscleGroups';
import { WEEKLY_SCHEDULE } from '../../constants/workoutSchedule';
import { errorMessage } from '../../services/cloud/cloudErrors';
import type { CustomDayPlan, DayId, MuscleGroupId } from '../../types/gym';
import {
  SPLIT_NAME_MAX_LENGTH,
  cloneSchedule,
  copyDayWorkout,
  isDayConfigured,
  normalizeSchedule,
  validateCustomSchedule,
} from '../../utils/workoutPlan';
import {
  exerciseIdsOfRegion,
  selectedExerciseIds,
  selectedRegionIds,
  setAllExercisesSelected,
  setAllRegionsSelected,
  setExerciseSelected,
  setMuscleGroupSelected,
  setRegionSelected,
  summarizeMuscleGroupSelection,
} from '../../utils/workoutSelection';
import { Modal } from '../Modal';

interface SplitEditorProps {
  isOpen: boolean;
  /** create: a new shared split; edit: rename / change an existing one. */
  mode: 'create' | 'edit';
  splitName: string;
  days: readonly CustomDayPlan[];
  /** Case-insensitive duplicate check against the account's other splits. */
  isNameTaken: (splitName: string) => boolean;
  /** Shown in edit mode: how many profiles use this shared split. */
  sharedProfileCount?: number;
  onClose: () => void;
  onSave: (splitName: string, days: CustomDayPlan[]) => Promise<void>;
}

const CATEGORY_TAG = { MACHINE: 'Machine', ALTERNATIVE: 'Alt' } as const;

/**
 * Seven days × three levels: Muscle Group → Target Region → Exercise Variation.
 * Groups and regions are accordions (collapsed by default), so the full exercise library is
 * never rendered at once. All selection rules live in utils/workoutSelection.ts.
 */
export function SplitEditor({ isOpen, mode, splitName, days, isNameTaken, sharedProfileCount = 0, onClose, onSave }: SplitEditorProps) {
  const nameId = useId();
  const [name, setName] = useState(splitName);
  const [draft, setDraft] = useState<CustomDayPlan[]>(() => cloneSchedule(days));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const [searchByGroupKey, setSearchByGroupKey] = useState<Record<string, string>>({});
  /** "Copy From Another Day" panel: which day is being filled, and from where. */
  const [copyDestinationDayId, setCopyDestinationDayId] = useState<DayId | null>(null);
  const [copySourceDayId, setCopySourceDayId] = useState<DayId | null>(null);
  const [copyNotice, setCopyNotice] = useState<{ dayId: DayId; message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(splitName);
    setDraft(cloneSchedule(days));
    setError(null);
    setSaving(false);
    setExpandedKeys(new Set());
    setSearchByGroupKey({});
    setCopyDestinationDayId(null);
    setCopySourceDayId(null);
    setCopyNotice(null);
  }, [isOpen, splitName, days]);

  const dayName = (dayId: DayId) => WEEKLY_SCHEDULE.find((meta) => meta.id === dayId)?.dayName ?? dayId;
  const describeDay = (day: CustomDayPlan) =>
    day.isRest || day.muscleGroupIds.length === 0
      ? `${day.workoutName.trim() || 'Rest'} (rest)`
      : `${day.workoutName.trim() || 'Workout'} (${day.muscleGroupIds.map((id) => MUSCLE_GROUPS_BY_ID[id].name).join(', ')})`;

  const openCopyPanel = (destinationDayId: DayId) => {
    setCopyDestinationDayId(destinationDayId);
    setCopySourceDayId(WEEKLY_SCHEDULE.find((meta) => meta.id !== destinationDayId)?.id ?? null);
    setCopyNotice(null);
  };

  /** Replaces the destination day with an exact copy of the source day (modes, empty selections, name, rest). */
  const confirmCopy = () => {
    if (!copyDestinationDayId || !copySourceDayId) return;
    const destinationDayId = copyDestinationDayId;
    const sourceDayId = copySourceDayId;
    try {
      setDraft((current) => copyDayWorkout(current, sourceDayId, destinationDayId));
      setExpandedKeys((current) => new Set([...current].filter((key) => !key.startsWith(`${destinationDayId}:`))));
      setCopyNotice({ dayId: destinationDayId, tone: 'success', message: `Copied ${dayName(sourceDayId)}’s workout to ${dayName(destinationDayId)}.` });
      setError(null);
    } catch (copyError) {
      setCopyNotice({ dayId: destinationDayId, tone: 'error', message: errorMessage(copyError, 'Could not copy that day.') });
    }
    setCopyDestinationDayId(null);
  };

  const updateDay = (dayId: DayId, change: (day: CustomDayPlan) => CustomDayPlan) => {
    setDraft((current) => current.map((day) => (day.dayId === dayId ? change(day) : day)));
    setError(null);
  };

  const toggleExpanded = (key: string) =>
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    const cleaned = normalizeSchedule(draft);
    const problem = validateCustomSchedule(name, cleaned) ?? (isNameTaken(name) ? 'Your account already has a split with this name. Choose another name.' : null);
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

  const renderGroup = (day: CustomDayPlan, muscleGroupId: MuscleGroupId) => {
    const group = MUSCLE_GROUPS_BY_ID[muscleGroupId];
    const groupKey = `${day.dayId}:${muscleGroupId}`;
    const isGroupOpen = expandedKeys.has(groupKey);
    const summary = summarizeMuscleGroupSelection(day, muscleGroupId);
    const regionIds = selectedRegionIds(day, muscleGroupId);
    const search = (searchByGroupKey[groupKey] ?? '').trim().toLowerCase();
    const regionWord = muscleGroupId === 'triceps' ? 'heads' : 'regions';

    return (
      <div key={muscleGroupId} className={`split-group${isGroupOpen ? ' is-open' : ''}`} data-testid={`split-group-${day.dayId}-${muscleGroupId}`}>
        <button
          type="button"
          className="split-group__header"
          aria-expanded={isGroupOpen}
          onClick={() => toggleExpanded(groupKey)}
          data-testid={`split-group-toggle-${day.dayId}-${muscleGroupId}`}
        >
          <span className="split-group__name">{group.name}</span>
          <span className="split-group__count" data-testid={`split-group-count-${day.dayId}-${muscleGroupId}`}>
            {summary.selectedRegionCount}/{summary.totalRegionCount} {regionWord} · {summary.selectedExerciseCount}/{summary.totalExerciseCount} exercises
          </span>
          <ChevronDown size={16} className="split-group__chevron" aria-hidden="true" />
        </button>

        {isGroupOpen && (
          <div className="split-group__body">
            <div className="split-bulk" role="group" aria-label={`${group.name} ${regionWord}`}>
              <button type="button" className="chip-button" onClick={() => updateDay(day.dayId, (current) => setAllRegionsSelected(current, muscleGroupId, true))} data-testid={`select-all-regions-${day.dayId}-${muscleGroupId}`}>
                Select All {regionWord}
              </button>
              <button type="button" className="chip-button" onClick={() => updateDay(day.dayId, (current) => setAllRegionsSelected(current, muscleGroupId, false))} data-testid={`deselect-all-regions-${day.dayId}-${muscleGroupId}`}>
                Deselect All {regionWord}
              </button>
            </div>
            <label className="split-search">
              <Search size={14} aria-hidden="true" />
              <span className="visually-hidden">Search {group.name} exercises</span>
              <input
                type="search"
                placeholder={`Search ${group.name.toLowerCase()} exercises`}
                value={searchByGroupKey[groupKey] ?? ''}
                onChange={(event) => setSearchByGroupKey((current) => ({ ...current, [groupKey]: event.target.value }))}
                data-testid={`split-search-${day.dayId}-${muscleGroupId}`}
              />
            </label>

            <ul className="split-regions">
              {group.regions.map((region) => {
                const regionKey = `${groupKey}:${region.id}`;
                const isRegionChecked = regionIds.includes(region.id);
                const allExerciseIds = exerciseIdsOfRegion(region.id);
                const chosenExerciseIds = selectedExerciseIds(day, muscleGroupId, region.id);
                const visibleExerciseIds = search
                  ? allExerciseIds.filter((exerciseId) => EXERCISES_BY_ID.get(exerciseId)?.name.toLowerCase().includes(search))
                  : allExerciseIds;
                if (search && visibleExerciseIds.length === 0) return null;
                const isRegionOpen = search ? true : expandedKeys.has(regionKey);
                return (
                  <li key={region.id} className="split-region" data-testid={`split-region-${day.dayId}-${region.id}`}>
                    <div className="split-region__row">
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={isRegionChecked}
                          onChange={(event) => updateDay(day.dayId, (current) => setRegionSelected(current, muscleGroupId, region.id, event.target.checked))}
                          data-testid={`region-check-${day.dayId}-${region.id}`}
                        />
                        <span className="check-row__label">{region.name}</span>
                      </label>
                      <button
                        type="button"
                        className="split-region__toggle"
                        aria-expanded={isRegionOpen}
                        aria-label={`${region.name} exercises`}
                        onClick={() => toggleExpanded(regionKey)}
                        data-testid={`region-toggle-${day.dayId}-${region.id}`}
                      >
                        <span className="split-region__count" data-testid={`region-count-${day.dayId}-${region.id}`}>
                          {chosenExerciseIds.length}/{allExerciseIds.length}
                        </span>
                        <ChevronDown size={16} className="split-group__chevron" aria-hidden="true" />
                      </button>
                    </div>

                    {isRegionOpen && (
                      <div className="split-region__body">
                        <div className="split-bulk" role="group" aria-label={`${region.name} exercises`}>
                          <button type="button" className="chip-button" onClick={() => updateDay(day.dayId, (current) => setAllExercisesSelected(current, muscleGroupId, region.id, true))} data-testid={`select-all-exercises-${day.dayId}-${region.id}`}>
                            Select All Exercises
                          </button>
                          <button type="button" className="chip-button" onClick={() => updateDay(day.dayId, (current) => setAllExercisesSelected(current, muscleGroupId, region.id, false))} data-testid={`deselect-all-exercises-${day.dayId}-${region.id}`}>
                            Deselect All Exercises
                          </button>
                        </div>
                        {allExerciseIds.length === 0 ? (
                          <p className="split-region__empty">No exercises in the library for this region.</p>
                        ) : (
                          <ul className="split-exercises">
                            {visibleExerciseIds.map((exerciseId) => {
                              const exercise = EXERCISES_BY_ID.get(exerciseId);
                              if (!exercise) return null;
                              return (
                                <li key={exerciseId}>
                                  <label className="check-row check-row--exercise">
                                    <input
                                      type="checkbox"
                                      checked={chosenExerciseIds.includes(exerciseId)}
                                      onChange={(event) =>
                                        updateDay(day.dayId, (current) => setExerciseSelected(current, muscleGroupId, region.id, exerciseId, event.target.checked))
                                      }
                                      data-testid={`exercise-check-${day.dayId}-${exerciseId}`}
                                    />
                                    <span className="check-row__label">{exercise.name}</span>
                                    <span className="check-row__tag">{CATEGORY_TAG[exercise.category]}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create split' : 'Edit split'}
      description={
        mode === 'edit' && sharedProfileCount > 1
          ? `Shared split: saving updates it for all ${sharedProfileCount} profiles using it. Duplicate it to make a separate version.`
          : 'Shared with every profile of your account. Pick muscle groups per day, then narrow regions and exercises if you like — everything starts selected.'
      }
      placement="top"
    >
      <div className="form split-editor">
        <div className="field">
          <label className="field__label" htmlFor={nameId}>
            Split name
          </label>
          <input
            id={nameId}
            className="field__input"
            value={name}
            maxLength={SPLIT_NAME_MAX_LENGTH}
            placeholder="e.g. Upper / Lower"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            data-autofocus
            data-testid="split-name"
          />
        </div>
        {WEEKLY_SCHEDULE.map((meta) => {
          const day = draft.find((candidate) => candidate.dayId === meta.id);
          if (!day) return null;
          const nameFieldId = `${nameId}-${meta.id}`;
          return (
            <fieldset key={meta.id} className="split-day" data-testid={`split-day-${meta.id}`}>
              <legend className="split-day__legend">{meta.dayName}</legend>
              <div className="split-day__copy">
                <button
                  type="button"
                  className="chip-button"
                  aria-expanded={copyDestinationDayId === meta.id}
                  onClick={() => (copyDestinationDayId === meta.id ? setCopyDestinationDayId(null) : openCopyPanel(meta.id))}
                  data-testid={`copy-day-${meta.id}`}
                >
                  <Copy size={14} aria-hidden="true" /> Copy From Another Day
                </button>
              </div>
              {copyDestinationDayId === meta.id && copySourceDayId && (
                <div className="copy-day-panel" role="group" aria-label={`Copy a workout into ${meta.dayName}`} data-testid={`copy-day-panel-${meta.id}`}>
                  <label className="field">
                    <span className="field__label">Copy from</span>
                    <select
                      className="field__input field__select"
                      value={copySourceDayId}
                      onChange={(event) => setCopySourceDayId(event.target.value as DayId)}
                      data-testid={`copy-day-source-${meta.id}`}
                    >
                      {draft
                        .filter((candidate) => candidate.dayId !== meta.id)
                        .map((candidate) => (
                          <option key={candidate.dayId} value={candidate.dayId}>
                            {dayName(candidate.dayId)} — {describeDay(candidate)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="copy-day-panel__summary" data-testid={`copy-day-summary-${meta.id}`}>
                    <strong>{dayName(copySourceDayId)}</strong> → <strong>{meta.dayName}</strong>: every muscle group, region and exercise choice is copied
                    exactly.
                  </p>
                  {isDayConfigured(day) && (
                    <p className="copy-day-panel__warning" role="alert">
                      This replaces {meta.dayName}’s current workout: {describeDay(day)}.
                    </p>
                  )}
                  <div className="split-bulk">
                    <button type="button" className="chip-button" onClick={() => setCopyDestinationDayId(null)}>
                      Cancel
                    </button>
                    <button type="button" className="button button--primary button--compact" onClick={confirmCopy} data-testid={`copy-day-confirm-${meta.id}`}>
                      {isDayConfigured(day) ? `Replace ${meta.dayName}` : `Copy to ${meta.dayName}`}
                    </button>
                  </div>
                </div>
              )}
              {copyNotice?.dayId === meta.id && (
                <p className={copyNotice.tone === 'success' ? 'inline-success' : 'field__error'} role="status" data-testid={`copy-day-notice-${meta.id}`}>
                  {copyNotice.tone === 'success' && <CheckCircle2 size={16} aria-hidden="true" />} {copyNotice.message}
                </p>
              )}
              <label className="split-day__rest">
                <input
                  type="checkbox"
                  checked={day.isRest}
                  onChange={(event) =>
                    updateDay(day.dayId, (current) =>
                      event.target.checked ? { ...current, isRest: true, muscleGroupIds: [], muscleGroupSelections: undefined } : { ...current, isRest: false },
                    )
                  }
                  data-testid={`split-rest-${meta.id}`}
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
                onChange={(event) => updateDay(day.dayId, (current) => ({ ...current, workoutName: event.target.value }))}
                data-testid={`split-workout-${meta.id}`}
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
                      onClick={() => updateDay(day.dayId, (current) => setMuscleGroupSelected(current, group.id, !selected))}
                      data-testid={`split-chip-${meta.id}-${group.id}`}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
              {!day.isRest && day.muscleGroupIds.length > 0 && (
                <div className="split-groups">{MUSCLE_GROUPS.filter((group) => day.muscleGroupIds.includes(group.id)).map((group) => renderGroup(day, group.id))}</div>
              )}
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
          <button type="button" className="button button--primary" onClick={() => void save()} disabled={saving} data-testid="split-save">
            {saving ? 'Saving…' : mode === 'create' ? 'Create split' : 'Save split'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
