import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

const TOAST_DURATION_MS = 2600;

/** Lightweight single-toast state for success/error feedback. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    window.clearTimeout(timeoutRef.current);
    setToast({ id: Date.now(), message, tone });
    timeoutRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return { toast, showToast };
}
