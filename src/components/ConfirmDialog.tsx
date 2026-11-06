import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  icon?: ReactNode;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Generic yes/no dialog built on the shared Modal. */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  icon,
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} description={description} icon={icon}>
      <div className="modal__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button type="button" className={`button ${destructive ? 'button--danger' : 'button--primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
