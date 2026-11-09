import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabaseClient';
import { getAppUrl } from '../../lib/supabaseConfig';
import { CloudError, toCloudError } from './cloudErrors';

/** Email / password authentication via Supabase Auth. */

export const MIN_PASSWORD_LENGTH = 8;

function friendlyAuthError(error: unknown, fallback: string): CloudError {
  const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : '';
  if (/invalid login credentials/i.test(message)) return new CloudError('Incorrect email or password.', 'auth');
  if (/email not confirmed/i.test(message)) return new CloudError('Please confirm your email first — check your inbox for the link.', 'auth');
  if (/already registered|already exists/i.test(message)) return new CloudError('An account with this email already exists. Try signing in.', 'conflict');
  if (/rate limit|too many/i.test(message)) return new CloudError('Too many attempts. Please wait a minute and try again.', 'auth');
  if (/password/i.test(message) && /least|weak|short/i.test(message)) return new CloudError(message, 'validation');
  return toCloudError(error, fallback);
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendlyAuthError(error, 'Could not sign in.');
}

/** Returns true when the account needs email confirmation before first sign-in. */
export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: getAppUrl() },
  });
  if (error) throw friendlyAuthError(error, 'Could not create the account.');
  return { needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw friendlyAuthError(error, 'Could not sign out.');
}

/**
 * Sends the recovery email. The link returns to this app (production or localhost —
 * both must be in Supabase → Authentication → URL Configuration → Redirect URLs).
 * With PKCE the link carries `?code=…` and only works in the browser that asked for it;
 * a `token_hash` email template (see SUPABASE_SETUP.md) works in any browser.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: getAppUrl() });
  if (error) throw friendlyAuthError(error, 'Could not send the reset email.');
}

/** Exchanges a `token_hash` recovery link for a recovery session (emits PASSWORD_RECOVERY). */
export async function verifyRecoveryToken(tokenHash: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error) throw new CloudError(RECOVERY_LINK_INVALID_MESSAGE, 'auth');
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (!error) return;
  const message = typeof error.message === 'string' ? error.message : '';
  if (/session.*missing|not authenticated|jwt|expired/i.test(message) || error.status === 401 || error.status === 403) {
    throw new CloudError(RECOVERY_SESSION_EXPIRED_MESSAGE, 'auth');
  }
  if (/different from the old|same.*password|should be different/i.test(message)) {
    throw new CloudError('Choose a password that is different from your current one.', 'validation');
  }
  throw friendlyAuthError(error, 'Could not update the password.');
}

/* ---------- Password recovery callback handling ---------- */

export const RECOVERY_LINK_INVALID_MESSAGE =
  'This email link is invalid, has expired or was already used. Request a new password reset link and open the newest email.';
export const RECOVERY_SESSION_EXPIRED_MESSAGE = 'Your reset session has expired. Request a new password reset link and try again.';
export const RECOVERY_WRONG_BROWSER_MESSAGE =
  'That email link was already used, or was opened in a different browser from the one that requested it. Resetting your password? Request a new link and open it in this browser. Confirming your email? You can sign in now.';
export const PASSWORD_UPDATED_MESSAGE = 'Password updated. Sign in with your new password.';

/** What an auth redirect put in the URL. Never contains tokens beyond the one-time token hash. */
export interface AuthRedirectInfo {
  /** `?code=` (PKCE confirmation or recovery link). */
  hasAuthCode: boolean;
  /** `token_hash` from a recovery link built with the token-hash email template. */
  recoveryTokenHash: string | null;
  /** `type=recovery` was present. */
  isRecoveryLink: boolean;
  /** Friendly message for an error Supabase put in the query string or the hash. */
  errorMessage: string | null;
}

const AUTH_QUERY_PARAMS = ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description', 'sb_flow_id'];

/** The hash is normally a `#/` route; Supabase may instead put `#error=…` (or tokens) there. */
function authHashParams(hash: string): URLSearchParams {
  const body = hash.replace(/^#/, '');
  if (body === '' || body.startsWith('/')) return new URLSearchParams();
  return new URLSearchParams(body);
}

function friendlyRedirectError(code: string | null, description: string | null): string | null {
  if (!code && !description) return null;
  if (code === 'otp_expired' || /expired|invalid/i.test(description ?? '')) return RECOVERY_LINK_INVALID_MESSAGE;
  return description ? description.replace(/\+/g, ' ') : 'That link could not be used. Please try again.';
}

/** Pure parser (unit-tested). Reads both the query string and a non-route hash. */
export function readAuthRedirect(href: string): AuthRedirectInfo {
  const url = new URL(href);
  const hash = authHashParams(url.hash);
  const read = (name: string) => url.searchParams.get(name) ?? hash.get(name);
  const type = read('type');
  const tokenHash = read('token_hash');
  return {
    hasAuthCode: url.searchParams.has('code'),
    recoveryTokenHash: tokenHash && type === 'recovery' ? tokenHash : null,
    isRecoveryLink: type === 'recovery',
    errorMessage: friendlyRedirectError(read('error_code') ?? read('error'), read('error_description')),
  };
}

/**
 * Captured once when the app loads — before Supabase removes `?code=` — so the auth
 * provider can explain failures (expired, reused or other-browser links).
 */
export const INITIAL_AUTH_REDIRECT: AuthRedirectInfo =
  typeof window === 'undefined'
    ? { hasAuthCode: false, recoveryTokenHash: null, isRecoveryLink: false, errorMessage: null }
    : readAuthRedirect(window.location.href);

const RECOVERY_PENDING_KEY = 'gymtrack-password-recovery-pending';

/** Per-tab flag so a reload of the Reset Password screen does not skip the reset. */
export function setRecoveryPending(pending: boolean): void {
  try {
    if (pending) window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1');
    else window.sessionStorage.removeItem(RECOVERY_PENDING_KEY);
  } catch {
    // Storage blocked (private mode): the in-memory status still drives this tab.
  }
}

export function isRecoveryPending(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw friendlyAuthError(error, 'Could not restore your session.');
  return data.session;
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/** Removes auth codes, token hashes and auth errors from the address bar (query and hash). */
export function cleanAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  const hasQueryParams = AUTH_QUERY_PARAMS.some((param) => url.searchParams.has(param));
  const hashParams = authHashParams(url.hash);
  const hasHashParams = [...hashParams.keys()].some((key) => AUTH_QUERY_PARAMS.includes(key) || key === 'access_token' || key === 'refresh_token');
  if (!hasQueryParams && !hasHashParams) return;
  AUTH_QUERY_PARAMS.forEach((param) => url.searchParams.delete(param));
  const hash = hasHashParams ? '#/' : url.hash;
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${hash}`);
}

/**
 * Re-checks the account password (Forgot PIN). Signing in again issues a fresh session
 * whose JWT `amr` timestamp the database checks before it allows a PIN reset.
 */
export async function confirmAccountPassword(email: string, password: string): Promise<void> {
  if (!email) throw new CloudError('Your account email is unknown. Sign out and sign in again.', 'auth');
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    const message = typeof error.message === 'string' ? error.message : '';
    if (/invalid login credentials/i.test(message)) throw new CloudError('That password is not correct.', 'auth');
    throw friendlyAuthError(error, 'Could not confirm your password.');
  }
}
