import { useEffect, useState, type ReactNode } from 'react';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { AlertTriangle, SearchX } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { EmptyState } from './components/EmptyState';
import { AccountBar, SyncBanner } from './components/SyncStatus';
import { EXERCISES_BY_ID, exerciseTargetsRegion } from './constants/exerciseLibrary';
import { MUSCLE_GROUPS_BY_ID, getMuscleRegion, isMuscleGroupId } from './constants/muscleGroups';
import { useCloudSlice, useCloudStatus, useProfiles } from './hooks/useCloud';
import { useHashRoute } from './hooks/useHashRoute';
import { useWorkoutPlan } from './hooks/useWorkoutPlan';
import { SUPABASE_CONFIG } from './lib/supabaseConfig';
import { AuthPage, ResetPasswordPage } from './pages/AuthPage';
import { ConsistencyTrackerPage } from './pages/ConsistencyTrackerPage';
import { DayDetailsPage } from './pages/DayDetailsPage';
import { ExerciseDetailsPage } from './pages/ExerciseDetailsPage';
import { MigrationPage } from './pages/MigrationPage';
import { MuscleGroupPage } from './pages/MuscleGroupPage';
import { MuscleRegionPage } from './pages/MuscleRegionPage';
import { ProfileDashboard } from './pages/ProfileDashboard';
import { ProfileOverviewPage } from './pages/ProfileOverviewPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SetupRequiredPage } from './pages/SetupRequiredPage';
import { rememberActiveProfile, rememberedActiveProfileId } from './services/activeProfileSession';
import { getMigrationMarker, hasLocalProfiles } from './services/cloud/dataMigrationService';
import { cloudStore } from './store/cloudStore';
import type { Profile, ProfileInput, Route } from './types/gym';

const Shell = ({ children, withNav = false }: { children: ReactNode; withNav?: boolean }) => (
  <main className={withNav ? 'app app--with-nav' : 'app'}>{children}</main>
);

const Loading = ({ label }: { label: string }) => (
  <Shell>
    <div className="page page--center" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  </Shell>
);

export default function App() {
  if (!SUPABASE_CONFIG.ok) {
    return (
      <Shell>
        <SetupRequiredPage problems={SUPABASE_CONFIG.problems} />
      </Shell>
    );
  }
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Loading label="Restoring your session…" />;
  if (status === 'recovery') {
    return (
      <Shell>
        <ResetPasswordPage />
      </Shell>
    );
  }
  if (status === 'signed-out' || !user) {
    return (
      <Shell>
        <AuthPage />
      </Shell>
    );
  }
  return <CloudApp key={user.id} userId={user.id} />;
}

/** Signed-in app: waits for cloud data, offers the one-time import, then routes. */
function CloudApp({ userId }: { userId: string }) {
  const { phase, error } = useCloudStatus();
  const cloudProfiles = useCloudSlice((s) => s.profiles);
  const [migrationOpen, setMigrationOpen] = useState<boolean | null>(null);
  const localDataAvailable = hasLocalProfiles();
  const marker = getMigrationMarker(userId);
  // First sign-in on a device with old local data and an empty account → offer the import automatically.
  const autoOffer = phase === 'ready' && localDataAvailable && !marker && cloudProfiles.length === 0;

  // Keep the import screen open once shown — the import itself fills the cloud, which would
  // otherwise make `autoOffer` false and unmount the screen before it can show its result.
  useEffect(() => {
    if (migrationOpen === null && autoOffer) setMigrationOpen(true);
  }, [autoOffer, migrationOpen]);

  if (phase === 'loading' || phase === 'signed-out') return <Loading label="Loading your GymTrack data…" />;
  if (phase === 'error') {
    return (
      <Shell>
        <div className="page page--center">
          <EmptyState
            icon={<AlertTriangle size={28} aria-hidden="true" />}
            title="Couldn’t load your data"
            message={error ?? 'Something went wrong while contacting the server.'}
            action={
              <button type="button" className="button button--primary" onClick={() => void cloudStore.refreshAll()}>
                Try again
              </button>
            }
          />
        </div>
      </Shell>
    );
  }

  const showMigration = migrationOpen ?? autoOffer;
  if (showMigration) {
    return (
      <Shell>
        <MigrationPage userId={userId} cloudProfiles={cloudProfiles} onClose={() => setMigrationOpen(false)} />
      </Shell>
    );
  }

  return (
    <Shell withNav>
      <SyncBanner />
      <Routes onImport={localDataAvailable && marker?.status !== 'completed' ? () => setMigrationOpen(true) : undefined} />
    </Shell>
  );
}

type NotFoundRenderer = (title: string, message: string, actionLabel: string, onAction: () => void) => ReactNode;

function Routes({ onImport }: { onImport?: () => void }) {
  const [route, navigate] = useHashRoute();
  const { profiles, addProfile, editProfile, removeProfile } = useProfiles();
  const { toast, showToast } = useToast();
  const goHome = () => navigate({ name: 'profiles' });

  // Bottom bar: Weekly Plan / Consistency open the current (or last opened) profile.
  const openRemembered = (destination: 'dashboard' | 'consistency') => {
    const profileId = route.name === 'profiles' ? rememberedActiveProfileId() : route.profileId;
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      showToast('Select a profile first.', 'info');
      navigate({ name: 'profiles' });
      return;
    }
    navigate({ name: destination, profileId: profile.id });
  };

  useEffect(() => {
    if (route.name !== 'profiles') rememberActiveProfile(route.profileId);
  }, [route]);

  const activeProfile = route.name === 'profiles' ? null : profiles.find((candidate) => candidate.id === route.profileId) ?? null;

  const notFound: NotFoundRenderer = (title, message, actionLabel, onAction) => (
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
  );

  let page: ReactNode;
  if (route.name === 'profiles') {
    page = (
      <ProfilesPage
        profiles={profiles}
        accountBar={<AccountBar onImport={onImport} />}
        onOpenProfile={(profile) => {
          rememberActiveProfile(profile.id);
          navigate({ name: 'dashboard', profileId: profile.id });
        }}
        onCreateProfile={addProfile}
        onUpdateProfile={editProfile}
        onDeleteProfile={removeProfile}
      />
    );
  } else if (activeProfile) {
    page = (
      <ProfileScreens
        profile={activeProfile}
        route={route}
        navigate={navigate}
        goHome={goHome}
        notFound={notFound}
        onUpdateProfile={(input) => editProfile(activeProfile, input)}
        onDeleteProfile={async () => {
          await removeProfile(activeProfile.id);
          goHome();
        }}
      />
    );
  } else {
    page = notFound('Profile not found', 'This profile may have been deleted or the link is out of date.', 'Back to profiles', goHome);
  }

  return (
    <>
      <AppHeader
        activeProfile={activeProfile}
        isOverviewOpen={route.name === 'overview'}
        onOpenProfiles={goHome}
        onOpenProfileOverview={(profile) => {
          if (route.name !== 'overview') navigate({ name: 'overview', profileId: profile.id });
        }}
      />
      {page}
      <BottomNav route={route} onProfiles={goHome} onWeekly={() => openRemembered('dashboard')} onConsistency={() => openRemembered('consistency')} />
      <Toast toast={toast} />
    </>
  );
}

function ProfileScreens({
  profile,
  route,
  navigate,
  goHome,
  notFound,
  onUpdateProfile,
  onDeleteProfile,
}: {
  profile: Profile;
  route: Exclude<Route, { name: 'profiles' }>;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  goHome: () => void;
  notFound: NotFoundRenderer;
  onUpdateProfile: (input: ProfileInput) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
}) {
  const { activeDays } = useWorkoutPlan(profile.id);
  const profileId = profile.id;
  const openDashboard = () => navigate({ name: 'dashboard', profileId });

  if (route.name === 'dashboard') {
    return (
      <ProfileDashboard
        profile={profile}
        onBack={goHome}
        onSelectDay={(day) => navigate({ name: 'day', profileId, dayId: day.id })}
      />
    );
  }

  if (route.name === 'overview') {
    return (
      <ProfileOverviewPage
        key={profileId}
        profile={profile}
        onBack={openDashboard}
        onOpenWeeklyPlan={openDashboard}
        onOpenConsistency={() => navigate({ name: 'consistency', profileId })}
        onSwitchProfile={goHome}
        onUpdateProfile={onUpdateProfile}
        onDeleteProfile={onDeleteProfile}
      />
    );
  }

  if (route.name === 'consistency') {
    return <ConsistencyTrackerPage key={profileId} profile={profile} onBack={() => navigate({ name: 'overview', profileId })} />;
  }

  const day = activeDays.find((candidate) => candidate.id === route.dayId);
  if (!day) return notFound('Day not found', 'That day isn’t part of this workout plan.', 'Back to weekly plan', openDashboard);
  const dayId = day.id;
  const openDay = () => navigate({ name: 'day', profileId, dayId });

  if (route.name === 'day') {
    return (
      <DayDetailsPage
        key={`${profileId}:${dayId}:${day.title ?? day.category}`}
        profile={profile}
        day={day}
        onBack={openDashboard}
        onSelectMuscleGroup={(group) => navigate({ name: 'muscle', profileId, dayId, muscleId: group.id })}
      />
    );
  }

  const group = isMuscleGroupId(route.muscleId) ? MUSCLE_GROUPS_BY_ID[route.muscleId] : undefined;
  if (!group || !day.muscleGroupIds.includes(group.id)) {
    return notFound('Muscle group not found', 'That muscle group isn’t on this day.', `Back to ${day.dayName}`, openDay);
  }
  const muscleId = group.id;
  const openGroup = () => navigate({ name: 'muscle', profileId, dayId, muscleId });

  if (route.name === 'muscle') {
    return (
      <MuscleGroupPage
        profile={profile}
        day={day}
        group={group}
        onBack={openDay}
        onSelectRegion={(region) => navigate({ name: 'region', profileId, dayId, muscleId, regionId: region.id, category: 'MACHINE' })}
      />
    );
  }

  const region = getMuscleRegion(route.regionId);
  if (!region || region.muscleGroupId !== group.id) {
    return notFound('Region not found', `That region isn’t part of ${group.name}.`, `Back to ${group.name}`, openGroup);
  }
  const regionId = region.id;

  if (route.name === 'region') {
    return (
      <MuscleRegionPage
        profile={profile}
        group={group}
        region={region}
        category={route.category}
        onBack={openGroup}
        onChangeCategory={(category) => navigate({ name: 'region', profileId, dayId, muscleId, regionId, category }, { replace: true })}
        onSelectExercise={(exercise) => navigate({ name: 'exercise', profileId, dayId, muscleId, regionId, exerciseId: exercise.id })}
      />
    );
  }

  const exercise = EXERCISES_BY_ID.get(route.exerciseId);
  const openRegion = (category: 'MACHINE' | 'ALTERNATIVE' = 'MACHINE') => navigate({ name: 'region', profileId, dayId, muscleId, regionId, category });
  if (!exercise || !exerciseTargetsRegion(exercise, muscleId, regionId)) {
    return notFound('Exercise not found', `That exercise isn’t listed under ${region.name}.`, `Back to ${region.name}`, () => openRegion());
  }

  return (
    <ExerciseDetailsPage
      key={`${profileId}:${exercise.id}`}
      profile={profile}
      group={group}
      region={region}
      exercise={exercise}
      onBack={() => openRegion(exercise.category)}
    />
  );
}
