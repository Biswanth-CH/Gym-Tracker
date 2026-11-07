import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cleanAuthParamsFromUrl, onAuthChange, readAuthErrorFromUrl, signOut as signOutRequest } from '../services/cloud/authService';
import { cloudStore } from '../store/cloudStore';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'recovery';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** One-off message for the sign-in screen (e.g. "session expired"). */
  notice: string | null;
  setNotice: (message: string | null) => void;
  signOut: () => Promise<void>;
  /** Leaves password-recovery mode after the new password was saved. */
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Restores the persisted Supabase session (loading state while it does),
 * follows auth events, and starts / stops cloud sync for the signed-in account.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(() => readAuthErrorFromUrl());
  const manualSignOut = useRef(false);
  const statusRef = useRef<AuthStatus>('loading');
  statusRef.current = status;

  useEffect(() => {
    // Never call Supabase from inside this callback (it can deadlock the client);
    // just record state — effects below react to it.
    const unsubscribe = onAuthChange((event, session) => {
      const nextUser = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
      if (event === 'PASSWORD_RECOVERY') {
        setUser(nextUser);
        setStatus('recovery');
      } else if (nextUser) {
        setUser(nextUser);
        setStatus((current) => (current === 'recovery' ? 'recovery' : 'signed-in'));
      } else {
        if (event === 'SIGNED_OUT' && statusRef.current === 'signed-in' && !manualSignOut.current) {
          setNotice('Your session has ended. Please sign in again.');
        }
        manualSignOut.current = false;
        setUser(null);
        setStatus('signed-out');
      }
      window.setTimeout(cleanAuthParamsFromUrl, 0);
    });
    return unsubscribe;
  }, []);

  // Cloud sync follows the signed-in account.
  useEffect(() => {
    if (status === 'signed-in' && user) void cloudStore.start(user.id);
    else if (status === 'signed-out') cloudStore.stop();
  }, [status, user]);

  const signOut = useCallback(async () => {
    manualSignOut.current = true;
    cloudStore.stop();
    try {
      await signOutRequest();
    } finally {
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  const finishRecovery = useCallback(() => setStatus(user ? 'signed-in' : 'signed-out'), [user]);

  const value = useMemo(
    () => ({ status, user, notice, setNotice, signOut, finishRecovery }),
    [status, user, notice, signOut, finishRecovery],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
