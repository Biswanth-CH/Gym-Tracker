import { useId, useState, type FormEvent } from 'react';
import { CheckCircle2, Dumbbell, Eye, EyeOff, KeyRound, Loader2, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  MIN_PASSWORD_LENGTH,
  RECOVERY_LINK_INVALID_MESSAGE,
  RECOVERY_SESSION_EXPIRED_MESSAGE,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  validateCredentials,
} from '../services/cloud/authService';
import { errorMessage } from '../services/cloud/cloudErrors';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  testId,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  testId?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="field__password">
        <input
          id={id}
          className="field__input"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid={testId}
        />
        <button
          type="button"
          className="field__password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {hint && <span className="photo-picker__hint">{hint}</span>}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand auth-brand">
      <span className="brand__mark" aria-hidden="true">
        <Dumbbell size={22} strokeWidth={2.4} />
      </span>
      <div className="brand__text">
        <h1 className="brand__name">
          Gym<span>Track</span>
        </h1>
        <p className="brand__caption">Built by Bisss!</p>
      </div>
    </div>
  );
}

/** Create Account · Sign In · Forgot Password. */
export function AuthPage() {
  const { notice, setNotice } = useAuth();
  // A failed or expired reset link opens straight on "Forgot password" so a new link is one tap away.
  const [mode, setMode] = useState<Mode>(() =>
    notice?.message === RECOVERY_LINK_INVALID_MESSAGE || notice?.message === RECOVERY_SESSION_EXPIRED_MESSAGE ? 'forgot' : 'sign-in',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'forgot') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
    } else {
      const problem = validateCredentials(email, password);
      if (problem) {
        setError(problem);
        return;
      }
      if (mode === 'sign-up' && password !== confirm) {
        setError('The passwords don’t match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else if (mode === 'sign-up') {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setInfo('Account created! Check your email and click the confirmation link, then sign in here.');
          setMode('sign-in');
          setPassword('');
          setConfirm('');
        }
      } else {
        await requestPasswordReset(email);
        setInfo('If an account exists for that email, a password reset link is on its way. Open it in this browser on this device.');
      }
    } catch (submitError) {
      setError(errorMessage(submitError, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Reset your password';

  return (
    <div className="page auth-page">
      <Brand />
      <p className="hero__subtitle">Build consistency. Track progress.</p>

      <section className="detail-card auth-card" aria-labelledby="auth-heading">
        {mode !== 'forgot' && (
          <div className="tabs auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={`tabs__tab${mode === 'sign-in' ? ' is-active' : ''}`} onClick={() => switchMode('sign-in')}>
              <LogIn size={16} aria-hidden="true" /> Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={`tabs__tab${mode === 'sign-up' ? ' is-active' : ''}`} onClick={() => switchMode('sign-up')}>
              <UserPlus size={16} aria-hidden="true" /> Create account
            </button>
          </div>
        )}
        <h2 id="auth-heading" className="auth-card__title">
          {title}
        </h2>
        {mode === 'forgot' && <p className="detail-card__text">Enter your email and we’ll send you a link to choose a new password.</p>}

        {notice?.tone === 'error' && (
          <p className="inline-alert" role="alert" data-testid="auth-notice">
            {notice.message}
          </p>
        )}
        {notice?.tone === 'success' && (
          <p className="inline-success" role="status" data-testid="auth-notice">
            <CheckCircle2 size={16} aria-hidden="true" /> {notice.message}
          </p>
        )}
        {info && (
          <p className="inline-success" role="status">
            <MailCheck size={16} aria-hidden="true" /> {info}
          </p>
        )}

        <form className="form auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor={emailId} className="field__label">
              Email
            </label>
            <input id={emailId} className="field__input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="auth-email" />
          </div>
          {mode !== 'forgot' && (
            <PasswordField
              id={passwordId}
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              testId="auth-password"
              hint={mode === 'sign-up' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            />
          )}
          {mode === 'sign-up' && (
            <PasswordField id={confirmId} label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" testId="auth-confirm" />
          )}
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button button--primary auth-form__submit" disabled={busy} data-testid="auth-submit">
            {busy && <Loader2 size={18} className="spin" aria-hidden="true" />}
            {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-card__links">
          {mode === 'forgot' ? (
            <button type="button" className="link-button" onClick={() => switchMode('sign-in')}>
              Back to sign in
            </button>
          ) : (
            <button type="button" className="link-button" onClick={() => switchMode('forgot')}>
              <KeyRound size={14} aria-hidden="true" /> Forgot password?
            </button>
          )}
        </div>
      </section>
      <p className="auth-page__privacy">Your profiles and workouts are private to your account and sync across your devices.</p>
    </div>
  );
}

/** Shown after opening a password-reset link (status 'recovery'). */
export function ResetPasswordPage() {
  const { user, completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const passwordId = useId();
  const confirmId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirm('');
      // Signs out and shows "Password updated" on the Sign In screen.
      await completePasswordRecovery();
    } catch (submitError) {
      const message = errorMessage(submitError, 'Could not update the password.');
      setSessionExpired(message === RECOVERY_SESSION_EXPIRED_MESSAGE);
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div className="page auth-page">
      <Brand />
      <section className="detail-card auth-card" aria-labelledby="reset-heading" data-testid="reset-password-page">
        <h2 id="reset-heading" className="auth-card__title">
          Reset password
        </h2>
        <p className="detail-card__text">
          Choose a new password{user?.email ? <> for <strong>{user.email}</strong></> : null}.
        </p>
        <form className="form auth-form" onSubmit={handleSubmit} noValidate>
          <PasswordField
            id={passwordId}
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            testId="reset-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />
          <PasswordField id={confirmId} label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" testId="reset-confirm" />
          {error && (
            <p className="field__error" role="alert" data-testid="reset-error">
              {error}
            </p>
          )}
          <button type="submit" className="button button--primary auth-form__submit" disabled={busy || sessionExpired} data-testid="reset-submit">
            {busy && <Loader2 size={18} className="spin" aria-hidden="true" />} Update Password
          </button>
        </form>
        <div className="auth-card__links">
          <button
            type="button"
            className="link-button"
            onClick={() => void cancelPasswordRecovery(sessionExpired ? 'expired' : undefined)}
            disabled={busy}
            data-testid="reset-cancel"
          >
            {sessionExpired ? 'Request a new link' : 'Cancel and go to Sign In'}
          </button>
        </div>
      </section>
    </div>
  );
}
