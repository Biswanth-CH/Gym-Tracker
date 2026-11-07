import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearActiveProfileSelection } from '../services/activeProfileSession';
import {
  INITIAL_AUTH_REDIRECT,
  PASSWORD_UPDATED_MESSAGE,
  RECOVERY_SESSION_EXPIRED_MESSAGE,
  RECOVERY_WRONG_BROWSER_MESSAGE,
  cleanAuthParamsFromUrl,
  isRecoveryPending,
  onAuthChange,
  setRecoveryPending,
  signOut as signOutRequest,
  verifyRecoveryToken,
} from '../services/cloud/authService';
import { errorMessage } from '../services/cloud/cloudErrors';
import { cloudStore } from '../store/cloudStore';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'recovery';

export interface AuthUser {
  id: string;
  email: string;
}

/** One-off message for the sign-in screen (e.g. "session expired", "password updated"). */
export interface AuthNotice {
  tone: 'error' | 'success';
  message: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  notice: AuthNotice | null;
  setNotice: (notice: AuthNotice | null) => void;
  /** Logout Account: stops sync, clears the active profile, signs out of Supabase. */
  signOut: () => Promise<void>;
  /** After the new password is saved: sign out and return to Sign In with a success message. */
  completePasswordRecovery: () => Promise<void>;
  /** Leave the Reset Password screen without changing the password. */
  cancelPasswordRecovery: (reason?: 'expired') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** token-hash links are single-use: verify at most once per page load (StrictMode runs effects twice). */
let recoveryTokenVerification: Promise<void> | null = null;

const initialNotice = (): AuthNotice | null =>
  INITIAL_AUTH_REDIRECT.errorMessage ? { tone: 'error', message: INITIAL_AUTH_REDIRECT.errorMessage } : null;

/**
 * Restores the persisted Supabase session (loading state while it does), follows auth
 * events, runs the password-recovery flow, and starts / stops cloud sync for the account.
 *
 * Password recovery
 *  - PKCE link (`?code=`): supabase-js exchanges it and emits PASSWORD_RECOVERY.
 *  - token-hash link (`?token_hash=…&type=recovery`): verified here with verifyOtp,
 *    which also emits PASSWORD_RECOVERY. Works in any browser.
 *  - A per-tab flag keeps the Reset Password screen after a reload.
 *  - Expired / reused / other-browser links end on Sign In with a clear message.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice);
  const [verifyingRecoveryLink, setVerifyingRecoveryLink] = useState(() => INITIAL_AUTH_REDIRECT.recoveryTokenHash !== null);
  const manualSignOut = useRef(false);
  const statusRef = useRef<AuthStatus>('loading');
  statusRef.current = status;

  useEffect(() => {
    // Never call Supabase from inside this callback (it can deadlock the client);
    // just record state — effects below react to it.
    const unsubscribe = onAuthChange((event, session) => {
      const nextUser = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
      if (event === 'PASSWORD_RECOVERY' && nextUser) {
        setRecoveryPending(true);
        setUser(nextUser);
        setStatus('recovery');
      } else if (nextUser) {
        setUser(nextUser);
        setStatus((current) => (current === 'recovery' || isRecoveryPending() ? 'recovery' : 'signed-in'));
      } else {
        const wasRecovering = statusRef.current === 'recovery' || isRecoveryPending();
        if (event === 'SIGNED_OUT' && !manualSignOut.current) {
          if (wasRecovering) setNotice({ tone: 'error', message: RECOVERY_SESSION_EXPIRED_MESSAGE });
          else if (statusRef.current === 'signed-in') setNotice({ tone: 'error', message: 'Your session has ended. Please sign in again.' });
        }
        if (
          event === 'INITIAL_SESSION' &&
          INITIAL_AUTH_REDIRECT.hasAuthCode &&
          !INITIAL_AUTH_REDIRECT.errorMessage &&
          !INITIAL_AUTH_REDIRECT.recoveryTokenHash
        ) {
          // A `?code=` that produced no session: the PKCE verifier lives in another browser,
          // or the link was already used.
          setNotice({ tone: 'error', message: RECOVERY_WRONG_BROWSER_MESSAGE });
        }
        setRecoveryPending(false);
        manualSignOut.current = false;
        setUser(null);
        setStatus('signed-out');
      }
      window.setTimeout(cleanAuthParamsFromUrl, 0);
    });
    return unsubscribe;
  }, []);

  // token-hash recovery links: verify once, outside the auth callback.
  useEffect(() => {
    const tokenHash = INITIAL_AUTH_REDIRECT.recoveryTokenHash;
    if (!tokenHash) return;
    let cancelled = false;
    recoveryTokenVerification ??= verifyRecoveryToken(tokenHash);
    recoveryTokenVerification
      .catch((error: unknown) => {
        if (!cancelled) setNotice({ tone: 'error', message: errorMessage(error, 'This password reset link could not be used.') });
      })
      .finally(() => {
        if (!cancelled) setVerifyingRecoveryLink(false);
        window.setTimeout(cleanAuthParamsFromUrl, 0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cloud sync follows the signed-in account (never during password recovery).
  useEffect(() => {
    if (status === 'signed-in' && user) void cloudStore.start(user.id);
    else if (status === 'signed-out' || status === 'recovery') cloudStore.stop();
  }, [status, user]);

  const endSession = useCallback(async (nextNotice: AuthNotice | null) => {
    manualSignOut.current = true;
    cloudStore.stop();
    clearActiveProfileSelection();
    setRecoveryPending(false);
    try {
      await signOutRequest();
    } finally {
      setUser(null);
      setStatus('signed-out');
      setNotice(nextNotice);
    }
  }, []);

  const signOut = useCallback(() => endSession(null), [endSession]);

  const completePasswordRecovery = useCallback(
    () => endSession({ tone: 'success', message: PASSWORD_UPDATED_MESSAGE }).catch(() => undefined),
    [endSession],
  );

  const cancelPasswordRecovery = useCallback(
    (reason?: 'expired') =>
      endSession(reason === 'expired' ? { tone: 'error', message: RECOVERY_SESSION_EXPIRED_MESSAGE } : null).catch(() => undefined),
    [endSession],
  );

  const effectiveStatus: AuthStatus = verifyingRecoveryLink && status !== 'recovery' ? 'loading' : status;

  const value = useMemo(
    () => ({ status: effectiveStatus, user, notice, setNotice, signOut, completePasswordRecovery, cancelPasswordRecovery }),
    [effectiveStatus, user, notice, signOut, completePasswordRecovery, cancelPasswordRecovery],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
