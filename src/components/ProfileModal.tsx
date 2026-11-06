import { useEffect, useId, useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { PROFILE_NAME_MAX_LENGTH } from '../constants/storageKeys';
import type { Profile } from '../types/gym';
import { Modal } from './Modal';

interface ProfileModalProps {
  isOpen: boolean;
  /** When provided the modal edits this profile; otherwise it creates a new one. */
  profile: Profile | null;
  onClose: () => void;
  /** Should throw an Error with a user-facing message if saving fails. */
  onSave: (name: string) => void;
}

export function ProfileModal({ isOpen, profile, onClose, onSave }: ProfileModalProps) {
  const isEditing = profile !== null;
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile?.name ?? '');
      setError(null);
    }
  }, [isOpen, profile]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter a profile name.');
      return;
    }
    try {
      onSave(name);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit profile' : 'New profile'}
      description={
        isEditing ? 'Update the name for this workout space.' : 'Create a personal space to plan your training week.'
      }
      icon={<UserRound size={24} aria-hidden="true" />}
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={inputId} className="field__label">
            Profile name
          </label>
          <input
            id={inputId}
            data-autofocus
            className={`field__input${error ? ' field__input--invalid' : ''}`}
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Alex"
            maxLength={PROFILE_NAME_MAX_LENGTH + 10}
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <div className="field__meta">
            {error ? (
              <p id={errorId} className="field__error" role="alert">
                {error}
              </p>
            ) : (
              <span />
            )}
            <span className="field__count" aria-hidden="true">
              {name.trim().length}/{PROFILE_NAME_MAX_LENGTH}
            </span>
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary">
            {isEditing ? 'Save changes' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
