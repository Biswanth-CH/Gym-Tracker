import { useEffect, useState } from 'react';
import { ChevronRight, Copy, FilePlus2 } from 'lucide-react';
import type { WorkoutSplitTemplate } from '../../types/gym';
import { countTrainingDays } from '../../utils/workoutPlan';
import { Modal } from '../Modal';

interface CreateSplitChooserProps {
  isOpen: boolean;
  /** The account's saved splits (the shared library). */
  splits: readonly WorkoutSplitTemplate[];
  onClose: () => void;
  onCreateFromScratch: () => void;
  /** Opens the split editor pre-filled with a copy (days, selections, backgrounds). */
  onDuplicate: (template: WorkoutSplitTemplate) => void;
}

/** "Create Split": start from scratch (the existing flow) or duplicate a saved split. */
export function CreateSplitChooser({ isOpen, splits, onClose, onCreateFromScratch, onDuplicate }: CreateSplitChooserProps) {
  const [step, setStep] = useState<'choose' | 'pick'>('choose');

  useEffect(() => {
    if (isOpen) setStep('choose');
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 'pick' ? () => setStep('choose') : onClose}
      title={step === 'pick' ? 'Duplicate a split' : 'Create split'}
      description={
        step === 'pick'
          ? 'The copy gets every day, workout selection and weekly card background (same images, nothing re-uploaded). Changing the copy never changes the original.'
          : 'Start with an empty week, or copy one of your saved splits.'
      }
      placement="top"
    >
      {step === 'choose' ? (
        <ul className="create-split-options" data-testid="create-split-chooser">
          <li>
            <button type="button" className="create-split-option" onClick={onCreateFromScratch} data-testid="create-split-scratch">
              <FilePlus2 size={20} aria-hidden="true" />
              <span className="create-split-option__text">
                <span className="create-split-option__title">Create from Scratch</span>
                <span className="create-split-option__hint">Seven empty days to fill in</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
          <li>
            <button type="button" className="create-split-option" onClick={() => setStep('pick')} data-testid="create-split-duplicate">
              <Copy size={20} aria-hidden="true" />
              <span className="create-split-option__text">
                <span className="create-split-option__title">Duplicate Existing Split</span>
                <span className="create-split-option__hint">Copy days, selections and backgrounds</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
        </ul>
      ) : splits.length === 0 ? (
        <div className="create-split-empty" data-testid="create-split-empty">
          <p>You have no saved splits yet. Create one from scratch, or duplicate Push Pull Legs from the split list.</p>
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setStep('choose')}>
              Back
            </button>
            <button type="button" className="button button--primary" onClick={onCreateFromScratch}>
              Create from Scratch
            </button>
          </div>
        </div>
      ) : (
        <ul className="split-list" data-testid="duplicate-split-list">
          {splits.map((template) => {
            const trainingDays = countTrainingDays(template.days);
            return (
              <li key={template.id} className="split-option">
                <button type="button" className="split-option__main" onClick={() => onDuplicate(template)} data-testid="duplicate-split-option">
                  <span className="split-option__name">{template.splitName}</span>
                  <span className="split-option__meta">
                    {trainingDays} training {trainingDays === 1 ? 'day' : 'days'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
