import type { ReactNode } from 'react';
import { AlertTriangle, SearchX } from 'lucide-react';
import { EmptyState } from './components/EmptyState';
import { EXERCISES_BY_ID, exerciseTargetsRegion } from './constants/exerciseLibrary';
import { MUSCLE_GROUPS_BY_ID, getMuscleRegion, isMuscleGroupId } from './constants/muscleGroups';
import { getWorkoutDay } from './constants/workoutSchedule';
import { useHashRoute } from './hooks/useHashRoute';
import { useProfiles } from './hooks/useProfiles';
import { ConsistencyTrackerPage } from './pages/ConsistencyTrackerPage';
import { DayDetailsPage } from './pages/DayDetailsPage';
import { ExerciseDetailsPage } from './pages/ExerciseDetailsPage';
import { MuscleGroupPage } from './pages/MuscleGroupPage';
import { MuscleRegionPage } from './pages/MuscleRegionPage';
import { ProfileDashboard } from './pages/ProfileDashboard';
import { ProfilesPage } from './pages/ProfilesPage';

const Shell = ({ children }: { children: ReactNode }) => <main className="app">{children}</main>;

export default function App() {
  const [route, navigate] = useHashRoute();
  const { profiles, status, loadError, reload, addProfile, editProfile, removeProfile } = useProfiles();

  const goHome = () => navigate({ name: 'profiles' });

  const notFound = (title: string, message: string, actionLabel: string, onAction: () => void) => (
    <Shell>
      <div className="page page--center">
        <EmptyState
          icon={<SearchX size={28} aria-hidden="true" />}
          title={title}
          message={message}
          action={
            <button type="button" className="button button--primary" onClick={onAction}>
              {actionLabel}
            </button>
          }
        />
      </div>
    </Shell>
  );

  if (status === 'loading') {
    return (
      <Shell>
        <div className="page page--center" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span className="visually-hidden">Loading profiles…</span>
        </div>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
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
      </Shell>
    );
  }

  if (route.name === 'profiles') {
    return (
      <Shell>
        <ProfilesPage
          profiles={profiles}
          onOpenProfile={(profile) => navigate({ name: 'dashboard', profileId: profile.id })}
          onCreateProfile={(input) => addProfile(input)}
          onUpdateProfile={(profileId, input) => editProfile(profileId, input)}
          onDeleteProfile={removeProfile}
        />
      </Shell>
    );
  }

  const profile = profiles.find((candidate) => candidate.id === route.profileId);
  if (!profile) {
    return notFound('Profile not found', 'This profile may have been deleted or the link is out of date.', 'Back to profiles', goHome);
  }
  const profileId = profile.id;
  const openDashboard = () => navigate({ name: 'dashboard', profileId });

  if (route.name === 'dashboard') {
    return (
      <Shell>
        <ProfileDashboard
          profile={profile}
          onBack={goHome}
          onSelectDay={(day) => navigate({ name: 'day', profileId, dayId: day.id })}
          onOpenConsistency={() => navigate({ name: 'consistency', profileId })}
        />
      </Shell>
    );
  }

  if (route.name === 'consistency') {
    return (
      <Shell>
        <ConsistencyTrackerPage key={profileId} profile={profile} onBack={openDashboard} />
      </Shell>
    );
  }

  // Everything below lives under a workout day.
  const day = getWorkoutDay(route.dayId);
  if (!day) return notFound('Day not found', 'That day isn’t part of the weekly plan.', 'Back to weekly plan', openDashboard);
  const dayId = day.id;
  const openDay = () => navigate({ name: 'day', profileId, dayId });

  if (route.name === 'day') {
    return (
      <Shell>
        <DayDetailsPage
          key={dayId}
          profile={profile}
          day={day}
          onBack={openDashboard}
          onSelectMuscleGroup={(group) => navigate({ name: 'muscle', profileId, dayId, muscleId: group.id })}
        />
      </Shell>
    );
  }

  const group = isMuscleGroupId(route.muscleId) ? MUSCLE_GROUPS_BY_ID[route.muscleId] : undefined;
  if (!group) return notFound('Muscle group not found', 'That muscle group doesn’t exist.', `Back to ${day.dayName}`, openDay);
  const muscleId = group.id;
  const openGroup = () => navigate({ name: 'muscle', profileId, dayId, muscleId });

  if (route.name === 'muscle') {
    return (
      <Shell>
        <MuscleGroupPage
          profile={profile}
          day={day}
          group={group}
          onBack={openDay}
          onSelectRegion={(region) => navigate({ name: 'region', profileId, dayId, muscleId, regionId: region.id, category: 'MACHINE' })}
        />
      </Shell>
    );
  }

  const region = getMuscleRegion(route.regionId);
  if (!region || region.muscleGroupId !== group.id) {
    return notFound('Region not found', `That region isn’t part of ${group.name}.`, `Back to ${group.name}`, openGroup);
  }
  const regionId = region.id;

  if (route.name === 'region') {
    return (
      <Shell>
        <MuscleRegionPage
          profile={profile}
          group={group}
          region={region}
          category={route.category}
          onBack={openGroup}
          onChangeCategory={(category) => navigate({ name: 'region', profileId, dayId, muscleId, regionId, category }, { replace: true })}
          onSelectExercise={(exercise) => navigate({ name: 'exercise', profileId, dayId, muscleId, regionId, exerciseId: exercise.id })}
        />
      </Shell>
    );
  }

  const exercise = EXERCISES_BY_ID.get(route.exerciseId);
  const openRegion = (category: 'MACHINE' | 'ALTERNATIVE' = 'MACHINE') =>
    navigate({ name: 'region', profileId, dayId, muscleId, regionId, category });
  if (!exercise || !exerciseTargetsRegion(exercise, muscleId, regionId)) {
    return notFound('Exercise not found', `That exercise isn’t listed under ${region.name}.`, `Back to ${region.name}`, () => openRegion());
  }

  return (
    <Shell>
      <ExerciseDetailsPage
        key={`${profileId}:${exercise.id}`}
        profile={profile}
        group={group}
        region={region}
        exercise={exercise}
        onBack={() => openRegion(exercise.category)}
      />
    </Shell>
  );
}
