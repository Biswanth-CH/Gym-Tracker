import { useId, useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { PasswordField } from '../../pages/AuthPage';
import { confirmAccountPassword } from '../../services/cloud/authService';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { describePinFailure, profilePinService } from '../../services/cloud/profilePinService';

interface ForgotPinPanelProps {
  profileId: string;
  profileName: string;
  onReset: () => void;
  onCancel: () => void;
}

/**
 * Forgot PIN: the account owner re-enters the account password; the database then
 * allows clearing the PIN for 10 minutes. The old PIN is never shown or recovered.
 */
export function ForgotPinPanel({ profileId, profileName, onReset, onCancel }: ForgotPinPanelProps) {
  const { user } = useAuth();
  const passwordId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await confirmAccountPassword(user?.email ?? '', password);
      setPassword('');
      const result = await profilePinService.resetProfilePinAfterReauthentication(profileId);
      if (!result.ok) {
        setError(describePinFailure(result));
        return;
      }
      onReset();
    } catch (resetError) {
      setError(errorMessage(resetError, 'Could not reset the PIN.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form forgot-pin" onSubmit={submit} noValidate data-testid="forgot-pin">
      <p className="detail-card__text">
        Enter the password of <strong>{user?.email}</strong> to remove the PIN from <strong>{profileName}</strong>. You can set a new PIN afterwards
        in Edit Profile.
      </p>
      <PasswordField id={passwordId} label="Account password" value={password} onChange={setPassword} autoComplete="current-password" testId="forgot-pin-password" />
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={busy || !password} data-testid="forgot-pin-submit">
          {busy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />} Remove PIN
        </button>
      </div>
    </form>
  );
}
