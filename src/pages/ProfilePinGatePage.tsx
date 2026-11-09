import { useState, type FormEvent } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { ForgotPinPanel } from '../components/profileLock/ForgotPinPanel';
import { PinInput } from '../components/profileLock/PinInput';
import { useProfileLocks } from '../hooks/useProfileLocks';
import { errorMessage } from '../services/cloud/cloudErrors';
import { describePinFailure, isValidPin, profilePinService } from '../services/cloud/profilePinService';
import type { Profile } from '../types/gym';

interface ProfilePinGatePageProps {
  profile: Profile;
  onCancel: () => void;
}

/** Shown instead of every screen of a PIN-locked profile until the PIN is verified on the server. */
export function ProfilePinGatePage({ profile, onCancel }: ProfilePinGatePageProps) {
  const { markProfileUnlocked } = useProfileLocks();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !isValidPin(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await profilePinService.verifyProfilePin(profile.id, pin);
      setPin('');
      if (result.ok) markProfileUnlocked(profile.id);
      else setError(describePinFailure(result));
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Could not check the PIN.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page pin-gate" data-testid="pin-gate">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onCancel} />
      </nav>
      <section className="detail-card pin-gate__card" aria-labelledby="pin-gate-title">
        <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={72} />
        <h1 id="pin-gate-title" className="pin-gate__title">
          <Lock size={18} aria-hidden="true" /> {profile.name}
        </h1>
        {forgotOpen ? (
          <ForgotPinPanel
            profileId={profile.id}
            profileName={profile.name}
            onCancel={() => setForgotOpen(false)}
            onReset={() => {
              setForgotOpen(false);
              markProfileUnlocked(profile.id);
            }}
          />
        ) : (
          <form className="form pin-gate__form" onSubmit={submit} noValidate>
            <PinInput label="Enter the 4-digit PIN" value={pin} onChange={setPin} testId="pin-gate-input" autoFocus />
            {error && (
              <p className="field__error" role="alert" data-testid="pin-gate-error">
                {error}
              </p>
            )}
            <button type="submit" className="button button--primary" disabled={busy || !isValidPin(pin)} data-testid="pin-gate-submit">
              {busy && <Loader2 size={18} className="spin" aria-hidden="true" />} Unlock
            </button>
            <button type="button" className="link-button" onClick={() => setForgotOpen(true)} data-testid="pin-gate-forgot">
              Forgot PIN?
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
