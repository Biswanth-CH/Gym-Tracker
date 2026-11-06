import { AlertTriangle, SearchX } from 'lucide-react';
import { EmptyState } from './components/EmptyState';
import { getWorkoutDay } from './constants/workoutSchedule';
import { useHashRoute } from './hooks/useHashRoute';
import { useProfiles } from './hooks/useProfiles';
import { DayDetailsPage } from './pages/DayDetailsPage';
import { ProfileDashboard } from './pages/ProfileDashboard';
import { ProfilesPage } from './pages/ProfilesPage';
import type { DayId } from './types/gym';

export default function App() {
  const [route, navigate] = useHashRoute();
  const { profiles, status, loadError, reload, addProfile, editProfile, removeProfile } = useProfiles();

  const goHome = () => navigate({ name: 'profiles' });

  if (status === 'loading') {
    return (
      <main className="app">
        <div className="page page--center" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span className="visually-hidden">Loading profiles…</span>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app">
        <div className="page page--center">
          <EmptyState
            icon={<AlertTriangle size={28} aria-hidden="true" />}
            title="Couldn’t load your profiles"
            message={loadError ?? 'Something went wrong while reading saved data.'}
            action={
              <button type="button" className="button button--primary" onClick={reload}>
                Try again
              </button>
            }
          />
        </div>
      </main>
    );
  }

  if (route.name === 'profiles') {
    return (
      <main className="app">
        <ProfilesPage
          profiles={profiles}
          onOpenProfile={(profile) => navigate({ name: 'dashboard', profileId: profile.id })}
          onCreateProfile={(name) => addProfile(name)}
          onUpdateProfile={(profileId, name) => editProfile(profileId, { name })}
          onDeleteProfile={removeProfile}
        />
      </main>
    );
  }

  const profile = profiles.find((candidate) => candidate.id === route.profileId);
  if (!profile) {
    return (
      <main className="app">
        <div className="page page--center">
          <EmptyState
            icon={<SearchX size={28} aria-hidden="true" />}
            title="Profile not found"
            message="This profile may have been deleted or the link is out of date."
            action={
              <button type="button" className="button button--primary" onClick={goHome}>
                Back to profiles
              </button>
            }
          />
        </div>
      </main>
    );
  }

  const openDashboard = () => navigate({ name: 'dashboard', profileId: profile.id });
  const selectDay = (dayId: DayId) =>
    navigate({ name: 'day', profileId: profile.id, dayId });

  const day = route.name === 'day' ? getWorkoutDay(route.dayId) : undefined;

  return (
    <main className="app">
      {day ? (
        <DayDetailsPage
          key={day.id}
          profile={profile}
          day={day}
          onBack={openDashboard}
          onSelectDay={(nextDay) => selectDay(nextDay.id)}
        />
      ) : (
        <ProfileDashboard profile={profile} onBack={goHome} onSelectDay={(nextDay) => selectDay(nextDay.id)} />
      )}
    </main>
  );
}
