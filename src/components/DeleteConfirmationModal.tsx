import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Profile } from '../types/gym';
import { Modal } from './Modal';

interface DeleteConfirmationModalProps {
  profile: Profile | null;
  onCancel: () => void;
  /** Rejects with a user-facing Error if deletion fails. */
  onConfirm: (profile: Profile) => Promise<void>;
}

export function DeleteConfirmationModal({ profile, onCancel, onConfirm }: DeleteConfirmationModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    setBusy(false);
  }, [profile]);

  const handleConfirm = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await onConfirm(profile);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={profile !== null}
      onClose={onCancel}
      title={`Delete “${profile?.name ?? ''}”?`}
      description="This profile and all its attendance, exercise selections, set plans and personal records will be deleted from your account on every device. This can’t be undone."
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
        <button type="button" className="button button--danger" onClick={() => void handleConfirm()} disabled={busy}>
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
