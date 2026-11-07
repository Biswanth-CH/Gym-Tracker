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

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: getAppUrl() });
  if (error) throw friendlyAuthError(error, 'Could not send the reset email.');
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw friendlyAuthError(error, 'Could not update the password.');
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

/** Removes `?code=…` (PKCE) and auth error params from the address bar after sign-in redirects. */
export function cleanAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  const authParams = ['code', 'error', 'error_code', 'error_description', 'type'];
  if (!authParams.some((param) => url.searchParams.has(param))) return;
  authParams.forEach((param) => url.searchParams.delete(param));
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** An auth error passed back in the redirect URL (e.g. expired reset link), if any. */
export function readAuthErrorFromUrl(): string | null {
  const url = new URL(window.location.href);
  const description = url.searchParams.get('error_description');
  return description ? description.replace(/\+/g, ' ') : null;
}
