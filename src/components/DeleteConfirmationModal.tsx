import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Profile } from '../types/gym';
import { Modal } from './Modal';

interface DeleteConfirmationModalProps {
  profile: Profile | null;
  onCancel: () => void;
  /** Should throw an Error with a user-facing message if deletion fails. */
  onConfirm: (profile: Profile) => void;
}

export function DeleteConfirmationModal({ profile, onCancel, onConfirm }: DeleteConfirmationModalProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [profile]);

  const handleConfirm = () => {
    if (!profile) return;
    try {
      onConfirm(profile);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this profile.');
    }
  };

  return (
    <Modal
      isOpen={profile !== null}
      onClose={onCancel}
      title={`Delete “${profile?.name ?? ''}”?`}
      description="This profile, its workout space and its attendance history will be removed from this device. This can’t be undone."
      icon={<Trash2 size={24} aria-hidden="true" />}
    >
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button type="button" className="button button--danger" onClick={handleConfirm}>
          Delete
        </button>
      </div>
    </Modal>
  );
}
