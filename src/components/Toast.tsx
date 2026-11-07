import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ToastMessage } from '../hooks/useToast';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

/** Always rendered so screen readers announce new messages in the live region. */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  const Icon = toast ? ICONS[toast.tone] : null;
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && Icon && (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <Icon size={18} aria-hidden="true" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
