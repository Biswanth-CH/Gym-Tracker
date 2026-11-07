import { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarDays, ChevronRight, Dumbbell, Flame, Gauge, LogOut, Pencil, Scale, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { BackButton } from '../components/BackButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { ProfileModal } from '../components/ProfileModal';
import { Toast } from '../components/Toast';
import { BodyWeightSection } from '../components/consistency/BodyWeightSection';
import { getGenderLabel } from '../constants/profileOptions';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useBodyWeight } from '../hooks/useBodyWeight';
import { useToast } from '../hooks/useToast';
import { errorMessage } from '../services/cloud/cloudErrors';
import type { Profile, ProfileInput } from '../types/gym';
import { calculateCurrentStreak, calculateMonthStats, formatPercentage, getTrackedMonths } from '../utils/consistencyUtils';
import { formatShortDate } from '../utils/dateUtils';
import { calculateBmi, formatBmi, formatHeightCm } from '../utils/profileDetails';
import { formatNumber } from '../utils/workoutUtils';

interface ProfileOverviewPageProps {
  profile: Profile;
  onBack: () => void;
  onOpenWeeklyPlan: () => void;
  onOpenConsistency: () => void;
  /** Back to the Profiles page. Keeps the Supabase session. */
  onSwitchProfile: () => void;
  onUpdateProfile: (input: ProfileInput) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
}

/** Personal dashboard for the active profile: details, key stats, body weight, shortcuts, account actions. */
export function ProfileOverviewPage({
  profile,
  onBack,
  onOpenWeeklyPlan,
  onOpenConsistency,
  onSwitchProfile,
  onUpdateProfile,
  onDeleteProfile,
}: ProfileOverviewPageProps) {
  const { signOut } = useAuth();
  const { toast, showToast } = useToast();
  const { todayKey, attendance, context } = useAttendanceTracker(profile, showToast);
  const { entries } = useBodyWeight(profile.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentMonth = useMemo(() => getTrackedMonths(todayKey, 1)[0], [todayKey]);
  const monthStats = useMemo(() => calculateMonthStats(currentMonth, attendance, context), [currentMonth, attendance, context]);
  const streak = useMemo(() => calculateCurrentStreak(attendance, context), [attendance, context]);
  const latestWeight = entries.length > 0 ? entries[entries.length - 1] : null;
  const latestWeightLabel = latestWeight ? `${formatNumber(Math.round(latestWeight.weightKg * 10) / 10)} kg` : '—';

  const details = [
    profile.ageYears !== null ? `Age: ${profile.ageYears}` : null,
    profile.heightCm !== null ? `Height: ${formatHeightCm(profile.heightCm)}` : null,
  ].filter((detail): detail is string => detail !== null);
  const bmi = calculateBmi(profile.heightCm, latestWeight?.weightKg ?? null);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      // The account is signed out locally either way; tell the user if the server call failed.
      showToast(errorMessage(error, 'Signed out on this device.'), 'info');
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <div className="page page--wide profile-overview" data-testid="profile-overview">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
      </nav>

      <section className="overview-identity" aria-labelledby="overview-name">
        <button
          type="button"
          className="icon-button overview-identity__edit"
          onClick={() => setEditorOpen(true)}
          aria-label="Edit Profile"
          title="Edit Profile"
          data-testid="overview-edit"
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
        <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={96} className="overview-identity__avatar" />
        <h1 id="overview-name" className="overview-identity__name">
          {profile.name}
        </h1>
        <p className="overview-identity__gender">{getGenderLabel(profile.gender)}</p>
        <p className="overview-identity__details" data-testid="overview-details">
          {details.length > 0 ? details.join(' | ') : 'Add your age and height in Edit Profile'}
        </p>
        {bmi && (
          <p className="overview-identity__details" data-testid="overview-bmi">
            BMI: <strong>{formatBmi(bmi)}</strong>
          </p>
        )}
        <p className="overview-identity__weight" data-testid="overview-weight">
          Weight: {latestWeight ? <strong>{latestWeightLabel}</strong> : 'not logged yet'}
          {latestWeight && <span className="muted"> · {formatShortDate(latestWeight.date)}</span>}
        </p>
      </section>

      <dl className="overview-stats" aria-label="Fitness statistics">
        <div className="overview-stat">
          <dt>
            <Gauge size={14} aria-hidden="true" /> Consistency
          </dt>
          <dd data-testid="overview-consistency">{formatPercentage(monthStats.percentage)}</dd>
          <dd className="overview-stat__hint">This month</dd>
        </div>
        <div className="overview-stat">
          <dt>
            <Flame size={14} aria-hidden="true" /> Streak
          </dt>
          <dd data-testid="overview-streak">
            {streak} <span className="overview-stat__unit">{streak === 1 ? 'day' : 'days'}</span>
          </dd>
          <dd className="overview-stat__hint">Current</dd>
        </div>
        <div className="overview-stat">
          <dt>
            <Dumbbell size={14} aria-hidden="true" /> Gym visits
          </dt>
          <dd data-testid="overview-visits">{monthStats.visits}</dd>
          <dd className="overview-stat__hint">{currentMonth.label}</dd>
        </div>
        <div className="overview-stat">
          <dt>
            <Scale size={14} aria-hidden="true" /> Weight
          </dt>
          <dd>{latestWeightLabel}</dd>
          <dd className="overview-stat__hint">Latest</dd>
        </div>
      </dl>

      <BodyWeightSection profile={profile} todayKey={todayKey} onToast={showToast} />

      <nav className="overview-links" aria-label="Shortcuts">
        <button type="button" className="overview-link" onClick={onOpenWeeklyPlan} data-testid="overview-weekly-plan">
          <CalendarDays size={18} aria-hidden="true" />
          <span>Weekly Workout Plan</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="overview-link" onClick={onOpenConsistency} data-testid="overview-consistency-tracker">
          <CalendarCheck2 size={18} aria-hidden="true" />
          <span>Consistency Tracker</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </nav>

      <section className="overview-actions" aria-label="Profile and account">
        <button type="button" className="button button--ghost" onClick={onSwitchProfile} data-testid="overview-switch-profile">
          <Users size={18} aria-hidden="true" /> Switch Profile
        </button>
        <button type="button" className="button button--ghost button--danger-text" onClick={() => setLogoutOpen(true)} data-testid="overview-logout">
          <LogOut size={18} aria-hidden="true" /> Logout Account
        </button>
      </section>

      <ProfileModal
        isOpen={editorOpen}
        profile={profile}
        onClose={() => setEditorOpen(false)}
        onSave={async (input) => {
          await onUpdateProfile(input);
          setEditorOpen(false);
          showToast('Profile updated');
        }}
        onDelete={async () => {
          await onDeleteProfile();
        }}
      />
      <ConfirmDialog
        isOpen={logoutOpen}
        title="Log out of GymTrack?"
        description="You’ll be signed out of this account on this device. Your profiles and workouts stay saved in the cloud. To use another profile without logging out, choose Switch Profile instead."
        confirmLabel={loggingOut ? 'Logging out…' : 'Logout Account'}
        icon={<LogOut size={24} aria-hidden="true" />}
        destructive
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => void confirmLogout()}
      />
      <Toast toast={toast} />
    </div>
  );
}
