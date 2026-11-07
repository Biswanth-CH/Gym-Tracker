import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, CloudUpload, Loader2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { errorMessage } from '../services/cloud/cloudErrors';
import {
  MIGRATION_STEPS,
  buildMigrationPlan,
  readLocalSnapshot,
  runMigration,
  setMigrationMarker,
  type LocalSnapshot,
  type MigrationPlan,
  type MigrationStepId,
  type StepStatus,
  type VerificationReport,
} from '../services/cloud/dataMigrationService';
import type { ProfileRow } from '../services/cloud/rows';
import { cloudStore } from '../store/cloudStore';

interface MigrationPageProps {
  userId: string;
  cloudProfiles: readonly ProfileRow[];
  onClose: () => void;
}

const STEP_ICON: Record<StepStatus, JSX.Element> = {
  pending: <Circle size={16} aria-hidden="true" />,
  running: <Loader2 size={16} className="spin" aria-hidden="true" />,
  done: <CheckCircle2 size={16} aria-hidden="true" />,
  failed: <XCircle size={16} aria-hidden="true" />,
};

/** Imports this browser's original GymTrack data into the signed-in account. */
export function MigrationPage({ userId, cloudProfiles, onClose }: MigrationPageProps) {
  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [steps, setSteps] = useState<Record<MigrationStepId, { status: StepStatus; detail?: string }> | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const local = readLocalSnapshot();
      setSnapshot(local);
      if (local) {
        buildMigrationPlan(local, cloudProfiles, userId)
          .then((built) => !cancelled && setPlan(built))
          .catch((planError) => !cancelled && setError(errorMessage(planError, 'Could not prepare the import.')));
      }
    } catch (readError) {
      setError(errorMessage(readError, 'Could not read the data saved in this browser.'));
    }
    return () => {
      cancelled = true;
    };
  }, [cloudProfiles, userId]);

  const start = async () => {
    if (!snapshot || !plan) return;
    setRunning(true);
    setError(null);
    setSteps(Object.fromEntries(MIGRATION_STEPS.map((step) => [step.id, { status: 'pending' as StepStatus }])) as Record<MigrationStepId, { status: StepStatus }>);
    try {
      const result = await runMigration(plan, snapshot, userId, (step, status, detail) =>
        setSteps((current) => (current ? { ...current, [step]: { status, detail } } : current)),
      );
      setReport(result);
      await cloudStore.refreshAll();
    } catch (runError) {
      setError(errorMessage(runError, 'The import stopped.'));
    } finally {
      setRunning(false);
    }
  };

  const skip = () => {
    setMigrationMarker(userId, { status: 'dismissed', at: new Date().toISOString() });
    onClose();
  };

  if (!snapshot) {
    return (
      <div className="page migration">
        <h1 className="page-title">Import data</h1>
        <p className="page-subtitle">{error ?? 'There is no GymTrack data saved in this browser to import.'}</p>
        <button type="button" className="button button--primary" onClick={onClose}>
          Continue
        </button>
      </div>
    );
  }

  const counts = plan?.counts;
  return (
    <div className="page migration" data-testid="migration-page">
      <header className="dashboard-header">
        <p className="eyebrow">One-time import</p>
        <h1 className="page-title">{plan?.cloudHasData ? 'Merge this device’s data' : 'Bring your data to the cloud'}</h1>
        <p className="page-subtitle">
          This browser has GymTrack data from before cloud sync. Import it into your account so it’s available on all your devices.
        </p>
      </header>

      {counts && (
        <section className="detail-card" aria-labelledby="import-summary-heading">
          <h2 id="import-summary-heading" className="detail-card__title">
            What will be imported
          </h2>
          <dl className="migration__counts" data-testid="migration-counts">
            <div><dt>Profiles</dt><dd>{counts.profiles}</dd></div>
            <div><dt>Profile pictures</dt><dd>{counts.photos}</dd></div>
            <div><dt>Attendance records</dt><dd>{counts.attendance}</dd></div>
            <div><dt>Set plans (from preferences)</dt><dd>{counts.plans}</dd></div>
            <div><dt>Personal records</dt><dd>{counts.records}</dd></div>
          </dl>
          <ul className="migration__profiles">
            {plan.items.map((item) => (
              <li key={item.local.id}>
                <strong>{item.local.name}</strong>
                <span className={`pill migration__action migration__action--${item.action}`}>
                  {item.action === 'create' ? 'New profile' : item.action === 'merge-by-name' ? `Merge into “${item.targetName}”` : 'Already in cloud'}
                </span>
              </li>
            ))}
          </ul>
          <p className="info-note info-note--inline">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Nothing in your account is overwritten — only missing items are added. The data in this browser is kept as it is, and a backup copy is saved first.
              {counts.workoutSessions > 0 &&
                ` Your ${counts.workoutSessions} old workout-log ${counts.workoutSessions === 1 ? 'session stays' : 'sessions stay'} saved in this browser; the best results become your imported PRs.`}
            </span>
          </p>
        </section>
      )}

      {steps && (
        <section className="detail-card" aria-labelledby="import-progress-heading">
          <h2 id="import-progress-heading" className="detail-card__title">
            Progress
          </h2>
          <ol className="migration__steps" data-testid="migration-steps">
            {MIGRATION_STEPS.map((step) => {
              const current = steps[step.id];
              return (
                <li key={step.id} className={`migration__step is-${current.status}`}>
                  {STEP_ICON[current.status]}
                  <span>{step.label}</span>
                  {current.detail && <span className="migration__detail">{current.detail}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {error && (
        <p className="inline-alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error} You can safely retry — already-imported items are skipped.
        </p>
      )}

      {report ? (
        <section className="detail-card migration__done" data-testid="migration-done">
          <CheckCircle2 size={28} aria-hidden="true" />
          <h2 className="auth-card__title">Import complete and verified</h2>
          <p className="detail-card__text">
            Your account now has {report.profiles} profile{report.profiles === 1 ? '' : 's'}, {report.attendance} attendance records, {report.plans} set plans and {report.records} personal records.
            {report.keptCloudValues > 0 && ` ${report.keptCloudValues} attendance entries already existed in the cloud with a different value and were kept.`}
          </p>
          <button type="button" className="button button--primary" onClick={onClose} data-testid="migration-continue">
            Continue to GymTrack
          </button>
        </section>
      ) : (
        <div className="migration__actions">
          <button type="button" className="button button--ghost" onClick={skip} disabled={running}>
            Not now
          </button>
          <button type="button" className="button button--primary" onClick={start} disabled={!plan || running} data-testid="migration-start">
            {running ? <Loader2 size={18} className="spin" aria-hidden="true" /> : error ? <RotateCcw size={18} aria-hidden="true" /> : <CloudUpload size={18} aria-hidden="true" />}
            {running ? 'Importing…' : error ? 'Retry import' : plan?.cloudHasData ? 'Merge data' : 'Import data'}
          </button>
        </div>
      )}
    </div>
  );
}
