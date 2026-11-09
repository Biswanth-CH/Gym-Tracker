import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import { CloudError, toCloudError } from './cloudErrors';
import { isMissingFunctionError } from './profileLockQueries';

/**
 * Optional 4-digit profile lock (Phase 6).
 *
 * The PIN never leaves this call: it is sent over HTTPS to SECURITY DEFINER Postgres
 * functions that bcrypt-hash / verify it, check auth.uid() ownership and enforce the
 * lockout (5 wrong PINs → 1, 2, 4 … 60 min). Nothing about the PIN is stored in the
 * browser, logged, or published through Realtime. It is a privacy convenience inside an
 * already signed-in account, not a replacement for account authentication.
 */

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

export type PinCheckResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin'; attemptsRemaining: number }
  | { ok: false; reason: 'locked'; lockedUntil: Date }
  | { ok: false; reason: 'reauthentication-required' }
  | { ok: false; reason: 'invalid-pin' };

const MIGRATION_HINT =
  'Profile PINs need the Phase 6 database update. Run supabase/migrations/20261109_phase6_shared_splits_themes_pins.sql in Supabase, then try again.';

interface RpcPinResponse {
  ok?: unknown;
  error?: unknown;
  lockedUntil?: unknown;
  attemptsRemaining?: unknown;
}

/** Maps the jsonb returned by the PIN functions. Exported for unit tests. */
export function toPinCheckResult(response: unknown): PinCheckResult {
  const value = (typeof response === 'object' && response !== null ? response : {}) as RpcPinResponse;
  if (value.ok === true) return { ok: true };
  if (value.error === 'reauthentication-required') return { ok: false, reason: 'reauthentication-required' };
  if (value.error === 'invalid-pin') return { ok: false, reason: 'invalid-pin' };
  if (typeof value.lockedUntil === 'string') {
    const lockedUntil = new Date(value.lockedUntil);
    if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now()) return { ok: false, reason: 'locked', lockedUntil };
  }
  const attemptsRemaining = typeof value.attemptsRemaining === 'number' ? value.attemptsRemaining : 0;
  return { ok: false, reason: 'wrong-pin', attemptsRemaining };
}

/** Human message for a failed check. */
export function describePinFailure(result: Exclude<PinCheckResult, { ok: true }>): string {
  switch (result.reason) {
    case 'locked': {
      const minutes = Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 60_000));
      return `Too many wrong PINs. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, or use Forgot PIN.`;
    }
    case 'wrong-pin':
      return result.attemptsRemaining > 0
        ? `Wrong PIN. ${result.attemptsRemaining} ${result.attemptsRemaining === 1 ? 'try' : 'tries'} left before a short lockout.`
        : 'Wrong PIN.';
    case 'reauthentication-required':
      return 'Please confirm your account password first.';
    case 'invalid-pin':
      return 'The PIN must be exactly 4 digits.';
  }
}

async function callPinFunction(name: string, args: Record<string, unknown>, fallback: string): Promise<PinCheckResult> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) {
    if (isMissingFunctionError(error)) throw new CloudError(MIGRATION_HINT, 'validation');
    throw toCloudError(error, fallback);
  }
  return toPinCheckResult(data);
}

export const profilePinService = {
  verifyProfilePin(profileId: string, pin: string): Promise<PinCheckResult> {
    if (!isValidPin(pin)) return Promise.resolve({ ok: false, reason: 'invalid-pin' });
    return callPinFunction('verify_profile_pin', { p_profile_id: profileId, p_pin: pin }, 'Could not check the PIN.');
  },

  /** Enables the lock, or changes the PIN (then `currentPin` is required). */
  async setProfilePin(profileId: string, newPin: string, currentPin: string | null): Promise<PinCheckResult> {
    if (!isValidPin(newPin)) return { ok: false, reason: 'invalid-pin' };
    const result = await callPinFunction(
      'set_profile_pin',
      { p_profile_id: profileId, p_new_pin: newPin, p_current_pin: currentPin },
      'Could not save the PIN.',
    );
    if (result.ok) await cloudStore.refreshLockedProfiles();
    return result;
  },

  async removeProfilePin(profileId: string, currentPin: string): Promise<PinCheckResult> {
    const result = await callPinFunction('remove_profile_pin', { p_profile_id: profileId, p_current_pin: currentPin }, 'Could not remove the PIN.');
    if (result.ok) await cloudStore.refreshLockedProfiles();
    return result;
  },

  /** Forgot PIN: only works within 10 minutes of re-entering the account password. Never reveals the old PIN. */
  async resetProfilePinAfterReauthentication(profileId: string): Promise<PinCheckResult> {
    const result = await callPinFunction('reset_profile_pin_after_reauth', { p_profile_id: profileId }, 'Could not reset the PIN.');
    if (result.ok) await cloudStore.refreshLockedProfiles();
    return result;
  },
};
