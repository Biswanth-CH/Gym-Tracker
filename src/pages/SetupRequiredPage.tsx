import { Database, Dumbbell } from 'lucide-react';

/** Shown when the build was made without valid Supabase settings. Local data is left untouched. */
export function SetupRequiredPage({ problems }: { problems: string[] }) {
  return (
    <div className="page auth-page">
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
      <section className="detail-card auth-card" aria-labelledby="setup-heading">
        <div className="empty-state__icon setup-icon">
          <Database size={28} aria-hidden="true" />
        </div>
        <h2 id="setup-heading" className="auth-card__title">
          Cloud sync isn’t configured yet
        </h2>
        <p className="detail-card__text">
          This build of GymTrack was made without Supabase settings, so it can’t sign in. Data already saved in this browser is safe and untouched.
        </p>
        <ul className="setup-problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p className="detail-card__text">
          Create <code>.env.local</code> from <code>.env.example</code>, add your project URL and publishable key, then run <code>npm run build</code> again.
          See <strong>SUPABASE_SETUP.md</strong> for the full steps.
        </p>
      </section>
    </div>
  );
}
