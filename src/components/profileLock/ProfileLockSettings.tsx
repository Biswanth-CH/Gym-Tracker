import { useState } from 'react';
import { CheckCircle2, Loader2, Lock, LockOpen } from 'lucide-react';
import { useProfileLocks } from '../../hooks/useProfileLocks';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { describePinFailure, isValidPin, profilePinService, type PinCheckResult } from '../../services/cloud/profilePinService';
import { ForgotPinPanel } from './ForgotPinPanel';
import { PinInput } from './PinInput';

type LockMode = 'idle' | 'enable' | 'change' | 'remove' | 'forgot';

interface ProfileLockSettingsProps {
  profileId: string;
  profileName: string;
}

/**
 * "Profile Lock" section of Edit Profile. Each action is saved on its own (server-side,
 * hashed); it does not wait for the profile form's Save button. PIN digits only live in
 * component state while typing.
 */
export function ProfileLockSettings({ profileId, profileName }: ProfileLockSettingsProps) {
  const { isProfileLocked, markProfileUnlocked } = useProfileLocks();
  const locked = isProfileLocked(profileId);
  const [mode, setMode] = useState<LockMode>('idle');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = (next: LockMode) => {
    setMode(next);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
  };

  const run = async (action: () => Promise<PinCheckResult>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(describePinFailure(result));
        return;
      }
      // The owner just proved the PIN (or set it) on this device: keep the profile open.
      markProfileUnlocked(profileId);
      reset('idle');
      setSuccess(successMessage);
    } catch (actionError) {
      setError(errorMessage(actionError, 'Could not update the profile lock.'));
    } finally {
      setBusy(false);
    }
  };

  const validateNewPin = (): string | null => {
    if (!isValidPin(newPin)) return 'The PIN must be exactly 4 digits.';
    if (newPin !== confirmPin) return 'The PINs don’t match.';
    return null;
  };

  const submitNewPin = () => {
    const problem = validateNewPin();
    if (problem) return setError(problem);
    if (mode === 'change' && !isValidPin(currentPin)) return setError('Enter the current 4-digit PIN.');
    void run(
      () => profilePinService.setProfilePin(profileId, newPin, mode === 'change' ? currentPin : null),
      mode === 'change' ? 'PIN changed.' : 'PIN lock enabled. This profile now asks for the PIN.',
    );
  };

  return (
    <section className="profile-lock" aria-label="Profile Lock" data-testid="profile-lock">
      <div className="profile-lock__header">
        <h3 className="profile-lock__title">
          {locked ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />} Profile Lock
        </h3>
        {!locked && (
          <label className="switch">
            <input
              type="checkbox"
              checked={mode === 'enable'}
              onChange={(event) => reset(event.target.checked ? 'enable' : 'idle')}
              data-testid="pin-enable-toggle"
            />
            <span>Enable 4-Digit PIN</span>
          </label>
        )}
      </div>
      <p className="profile-lock__hint">
        {locked
          ? 'This profile asks for its PIN when opened. It is a privacy lock inside your account, not a replacement for your account password.'
          : 'Optional. Ask for a 4-digit PIN before this profile opens.'}
      </p>

      {success && (
        <p className="inline-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" /> {success}
        </p>
      )}

      {locked && mode === 'idle' && (
        <div className="profile-lock__actions">
          <button type="button" className="button button--ghost button--compact" onClick={() => reset('change')} data-testid="pin-change">
            Change PIN
          </button>
          <button type="button" className="button button--ghost button--compact button--danger-text" onClick={() => reset('remove')} data-testid="pin-remove">
            Remove PIN
          </button>
          <button type="button" className="link-button" onClick={() => reset('forgot')} data-testid="pin-forgot">
            Forgot PIN?
          </button>
        </div>
      )}

      {(mode === 'enable' || mode === 'change') && (
        <div className="profile-lock__form">
          {mode === 'change' && <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} testId="pin-current" />}
          <div className="profile-details-row">
            <PinInput label={mode === 'change' ? 'New PIN' : 'PIN'} value={newPin} onChange={setNewPin} testId="pin-new" />
            <PinInput label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} testId="pin-confirm" />
          </div>
          <div className="profile-lock__actions">
            <button type="button" className="button button--ghost button--compact" onClick={() => reset('idle')} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="button button--primary button--compact" onClick={submitNewPin} disabled={busy} data-testid="pin-save">
              {busy && <Loader2 size={16} className="spin" aria-hidden="true" />} {mode === 'change' ? 'Change PIN' : 'Save PIN'}
            </button>
          </div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="profile-lock__form">
          <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} testId="pin-remove-current" />
          <div className="profile-lock__actions">
            <button type="button" className="button button--ghost button--compact" onClick={() => reset('idle')} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--compact"
              onClick={() => (isValidPin(currentPin) ? void run(() => profilePinService.removeProfilePin(profileId, currentPin), 'PIN removed.') : setError('Enter the current 4-digit PIN.'))}
              disabled={busy}
              data-testid="pin-remove-confirm"
            >
              Remove PIN
            </button>
          </div>
        </div>
      )}

      {mode === 'forgot' && (
        <ForgotPinPanel
          profileId={profileId}
          profileName={profileName}
          onCancel={() => reset('idle')}
          onReset={() => {
            reset('idle');
            setSuccess('PIN removed. You can enable a new PIN now.');
          }}
        />
      )}

      {error && (
        <p className="field__error" role="alert" data-testid="pin-error">
          {error}
        </p>
      )}
    </section>
  );
}
