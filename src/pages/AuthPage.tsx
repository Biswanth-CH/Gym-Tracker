import { useId, useState, type FormEvent } from 'react';
import { Dumbbell, KeyRound, Loader2, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { MIN_PASSWORD_LENGTH, requestPasswordReset, signIn, signUp, updatePassword, validateCredentials } from '../services/cloud/authService';
import { errorMessage } from '../services/cloud/cloudErrors';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

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
  const [mode, setMode] = useState<Mode>('sign-in');
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
        setInfo('If an account exists for that email, a password reset link is on its way. Open it on this device.');
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

        {notice && (
          <p className="inline-alert" role="alert">
            {notice}
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
            <div className="field">
              <label htmlFor={passwordId} className="field__label">
                Password
              </label>
              <input
                id={passwordId}
                className="field__input"
                type="password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="auth-password"
              />
              {mode === 'sign-up' && <span className="photo-picker__hint">At least {MIN_PASSWORD_LENGTH} characters.</span>}
            </div>
          )}
          {mode === 'sign-up' && (
            <div className="field">
              <label htmlFor={confirmId} className="field__label">
                Confirm password
              </label>
              <input id={confirmId} className="field__input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="auth-confirm" />
            </div>
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

/** Shown after opening a password-reset link. */
export function ResetPasswordPage() {
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      finishRecovery();
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not update the password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page auth-page">
      <Brand />
      <section className="detail-card auth-card" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="auth-card__title">
          Choose a new password
        </h2>
        <form className="form auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor={passwordId} className="field__label">
              New password
            </label>
            <input id={passwordId} className="field__input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={confirmId} className="field__label">
              Confirm new password
            </label>
            <input id={confirmId} className="field__input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button button--primary auth-form__submit" disabled={busy}>
            {busy && <Loader2 size={18} className="spin" aria-hidden="true" />} Save new password
          </button>
        </form>
      </section>
    </div>
  );
}
