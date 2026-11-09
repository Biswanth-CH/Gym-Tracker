import { useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { errorMessage } from '../../services/cloud/cloudErrors';
import type { ActiveWorkoutSplit, CustomDayPlan, WorkoutSplitTemplate } from '../../types/gym';
import { BUILT_IN_PPL_NAME, activeSplitName, countTrainingDays, defaultCustomSchedule } from '../../utils/workoutPlan';
import { Modal } from '../Modal';

interface WorkoutSplitSelectorProps {
  activeWorkoutSplit: ActiveWorkoutSplit;
  /** The account-wide shared library (every profile of this account sees the same list). */
  splitTemplates: readonly WorkoutSplitTemplate[];
  /** Profiles currently using each split (any profile of the account). */
  profileCountBySplitId: ReadonlyMap<string, number>;
  onActivateBuiltInPpl: () => Promise<void>;
  onActivateWorkoutSplit: (template: WorkoutSplitTemplate) => Promise<void>;
  onCreateWorkoutSplit: () => void;
  onEditWorkoutSplit: (template: WorkoutSplitTemplate) => void;
  /** Saves the legacy (pre-Phase 5) custom schedule as a proper saved split. */
  onSaveLegacySplit: (splitName: string, days: CustomDayPlan[]) => void;
  onDuplicateWorkoutSplit: (sourceName: string, sourceDays: readonly CustomDayPlan[]) => Promise<void>;
  onDeleteWorkoutSplit: (template: WorkoutSplitTemplate) => Promise<void>;
}

const PPL_DAYS = defaultCustomSchedule();

function trainingDaysLabel(days: readonly CustomDayPlan[]): string {
  const count = countTrainingDays(days);
  return `${count} training ${count === 1 ? 'day' : 'days'}`;
}

/**
 * "[Select Workout Split ▼] [+ Create Split]". The dialog lists the built-in PPL plan
 * and every saved split with its type, an active indicator and Edit / Duplicate / Delete.
 * Tapping a split activates it. Delete asks for confirmation inside the same dialog.
 */
export function WorkoutSplitSelector({
  activeWorkoutSplit,
  splitTemplates,
  profileCountBySplitId,
  onActivateBuiltInPpl,
  onActivateWorkoutSplit,
  onCreateWorkoutSplit,
  onEditWorkoutSplit,
  onSaveLegacySplit,
  onDuplicateWorkoutSplit,
  onDeleteWorkoutSplit,
}: WorkoutSplitSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [splitPendingDelete, setSplitPendingDelete] = useState<WorkoutSplitTemplate | null>(null);
  const activeTemplateId = activeWorkoutSplit.kind === 'CUSTOM' ? activeWorkoutSplit.template.id : null;
  const activeTypeLabel = activeWorkoutSplit.kind === 'PPL' ? 'Built-in' : 'Custom';

  useEffect(() => {
    if (isOpen) return;
    setError(null);
    setSplitPendingDelete(null);
    setBusyKey(null);
  }, [isOpen]);

  const run = async (key: string, action: () => Promise<void>, closeAfter: boolean) => {
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      await action();
      if (closeAfter) setIsOpen(false);
    } catch (actionError) {
      setError(errorMessage(actionError, 'Something went wrong. Please try again.'));
    } finally {
      setBusyKey(null);
    }
  };

  const deleteWarning = (template: WorkoutSplitTemplate, isActiveHere: boolean): string => {
    const users = profileCountBySplitId.get(template.id) ?? 0;
    const usedBy = users > 0 ? ` It is active for ${users} ${users === 1 ? 'profile' : 'profiles'}, which will switch to PPL.` : '';
    return `This deletes the split for every profile of your account.${usedBy}${isActiveHere && users === 0 ? ' This profile switches to PPL.' : ''} Other splits are not affected.`;
  };

  const confirmDelete = async (template: WorkoutSplitTemplate) => {
    await run(`delete:${template.id}`, () => onDeleteWorkoutSplit(template), false);
    setSplitPendingDelete(null);
  };

  return (
    <>
      <div className="split-selector">
        <button
          type="button"
          className="split-selector__trigger"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Workout split: ${activeSplitName(activeWorkoutSplit)}. Change split`}
          data-testid="split-selector"
        >
          <span className="split-selector__text" data-testid="split-selector-label">
            <span className="split-selector__name">{activeSplitName(activeWorkoutSplit)}</span>
            <span className="split-selector__type">{' – '}{activeTypeLabel}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="button button--ghost button--compact split-selector__create" onClick={onCreateWorkoutSplit} data-testid="split-create">
          <Plus size={16} aria-hidden="true" /> Create Split
        </button>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={splitPendingDelete ? () => setSplitPendingDelete(null) : () => setIsOpen(false)}
        title={splitPendingDelete ? `Delete “${splitPendingDelete.splitName}”?` : 'Workout splits'}
        description={
          splitPendingDelete
            ? splitPendingDelete.id === activeTemplateId
              ? deleteWarning(splitPendingDelete, true)
              : deleteWarning(splitPendingDelete, false)
            : 'Shared by all profiles of your account. Tap a split to make it THIS profile’s weekly plan; other profiles keep their own choice.'
        }
        placement="top"
      >
        {splitPendingDelete ? (
          <div className="modal__actions" data-testid="split-delete-confirm">
            <button type="button" className="button button--ghost" onClick={() => setSplitPendingDelete(null)} disabled={busyKey !== null} data-autofocus>
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void confirmDelete(splitPendingDelete)}
              disabled={busyKey !== null}
              data-testid="split-delete-confirm-button"
            >
              {busyKey ? 'Deleting…' : 'Delete split'}
            </button>
          </div>
        ) : (
          <>
            <ul className="split-list" data-testid="split-list">
              <li className={`split-option${activeWorkoutSplit.kind === 'PPL' ? ' is-active' : ''}`} data-testid="split-option-ppl">
                <button
                  type="button"
                  className="split-option__main"
                  onClick={() => void run('activate:ppl', onActivateBuiltInPpl, true)}
                  aria-pressed={activeWorkoutSplit.kind === 'PPL'}
                  disabled={busyKey !== null}
                >
                  <span className="split-option__name">{BUILT_IN_PPL_NAME}</span>
                  <span className="split-option__meta">
                    <Lock size={12} aria-hidden="true" /> Built-in · {trainingDaysLabel(PPL_DAYS)}
                  </span>
                </button>
                <span className="split-option__status">
                  {busyKey === 'activate:ppl' ? <Loader2 size={16} className="spin" aria-hidden="true" /> : activeWorkoutSplit.kind === 'PPL' ? <ActiveBadge /> : null}
                </span>
                <span className="split-option__actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Duplicate ${BUILT_IN_PPL_NAME} as a custom split`}
                    title="Duplicate"
                    disabled={busyKey !== null}
                    onClick={() => void run('duplicate:ppl', () => onDuplicateWorkoutSplit(BUILT_IN_PPL_NAME, PPL_DAYS), false)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>

              {activeWorkoutSplit.kind === 'LEGACY_CUSTOM' && (
                <li className="split-option is-active" data-testid="split-option-legacy">
                  <span className="split-option__main">
                    <span className="split-option__name">{activeWorkoutSplit.splitName}</span>
                    <span className="split-option__meta">Custom · not saved as a split yet</span>
                  </span>
                  <span className="split-option__status">
                    <ActiveBadge />
                  </span>
                  <span className="split-option__actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Save ${activeWorkoutSplit.splitName} as a split`}
                      title="Save as split"
                      onClick={() => {
                        setIsOpen(false);
                        onSaveLegacySplit(activeWorkoutSplit.splitName, activeWorkoutSplit.days);
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              )}

              {splitTemplates.map((template) => {
                const isActive = template.id === activeTemplateId;
                return (
                  <li key={template.id} className={`split-option${isActive ? ' is-active' : ''}`} data-testid="split-option">
                    <button
                      type="button"
                      className="split-option__main"
                      onClick={() => void run(`activate:${template.id}`, () => onActivateWorkoutSplit(template), true)}
                      aria-pressed={isActive}
                      disabled={busyKey !== null}
                    >
                      <span className="split-option__name">{template.splitName}</span>
                      <span className="split-option__meta">
                        Custom · {trainingDaysLabel(template.days)}
                        {(profileCountBySplitId.get(template.id) ?? 0) > 0 && ` · used by ${profileCountBySplitId.get(template.id)}`}
                      </span>
                    </button>
                    <span className="split-option__status">
                      {busyKey === `activate:${template.id}` ? <Loader2 size={16} className="spin" aria-hidden="true" /> : isActive ? <ActiveBadge /> : null}
                    </span>
                    <span className="split-option__actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Edit ${template.splitName}`}
                        title="Edit"
                        disabled={busyKey !== null}
                        onClick={() => {
                          setIsOpen(false);
                          onEditWorkoutSplit(template);
                        }}
                        data-testid="split-edit"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Duplicate ${template.splitName}`}
                        title="Duplicate"
                        disabled={busyKey !== null}
                        onClick={() => void run(`duplicate:${template.id}`, () => onDuplicateWorkoutSplit(template.splitName, template.days), false)}
                        data-testid="split-duplicate"
                      >
                        <Copy size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label={`Delete ${template.splitName}`}
                        title="Delete"
                        disabled={busyKey !== null}
                        onClick={() => setSplitPendingDelete(template)}
                        data-testid="split-delete"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {splitTemplates.length === 0 && activeWorkoutSplit.kind !== 'LEGACY_CUSTOM' && (
              <p className="split-list__empty">No saved splits yet. Create one, or duplicate Push Pull Legs and change it.</p>
            )}
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <div className="modal__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setIsOpen(false);
                  onCreateWorkoutSplit();
                }}
              >
                <Plus size={18} aria-hidden="true" /> Create Split
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function ActiveBadge() {
  return (
    <span className="split-option__active">
      <Check size={12} aria-hidden="true" /> Active
    </span>
  );
}
