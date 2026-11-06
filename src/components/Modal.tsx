import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Shown on top of the sheet, e.g. an icon badge. */
  icon?: ReactNode;
  /**
   * `sheet`: bottom sheet on phones (short confirmations).
   * `top`: anchored near the top on phones so forms stay above the keyboard.
   * Both are centred dialogs on larger screens.
   */
  placement?: 'sheet' | 'top';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell. Handles Escape, backdrop click, focus trapping,
 * focus restore and scroll lock. The backdrop tracks the *visual* viewport,
 * so when the on-screen keyboard opens the dialog shrinks to the visible area
 * and scrolls internally instead of hiding fields and buttons behind the keyboard.
 */
export function Modal({ isOpen, title, description, onClose, children, icon, placement = 'sheet' }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Keep the latest onClose without re-running the open/close effect,
  // which would otherwise steal focus on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const autoFocusTarget =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    autoFocusTarget?.focus({ preventScroll: true });

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Follow the visual viewport (shrinks when the mobile keyboard opens).
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop || !viewport) return;
      backdrop.style.setProperty('--vv-height', `${viewport.height}px`);
      backdrop.style.setProperty('--vv-top', `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);

    // Keep the focused field visible inside the dialog once the keyboard has opened.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches('input, select, textarea')) return;
      window.setTimeout(() => target.scrollIntoView({ block: 'nearest' }), 300);
    };
    dialog?.addEventListener('focusin', onFocusIn);

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      dialog?.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className={`modal-backdrop modal-backdrop--${placement}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={`modal modal--${placement}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        {placement === 'sheet' && <div className="modal__handle" aria-hidden="true" />}
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Close dialog">
          <X size={20} aria-hidden="true" />
        </button>
        {icon && <div className="modal__icon">{icon}</div>}
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="modal__description">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
