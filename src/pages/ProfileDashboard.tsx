import { CalendarCheck2 } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { DayCard } from '../components/DayCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Toast } from '../components/Toast';
import { AttendanceQuickLog } from '../components/consistency/AttendanceQuickLog';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useToast } from '../hooks/useToast';
import { WorkoutIcon } from '../components/WorkoutIcon';
import {
  WEEKLY_SCHEDULE,
  WORKOUT_CATEGORIES,
  WORKOUT_CATEGORY_ORDER,
  getTodayDayId,
} from '../constants/workoutSchedule';
import { getGenderLabel } from '../constants/profileOptions';
import type { Profile, WorkoutDay } from '../types/gym';

interface ProfileDashboardProps {
  profile: Profile;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
  onOpenConsistency: () => void;
}

export function ProfileDashboard({ profile, onBack, onSelectDay, onOpenConsistency }: ProfileDashboardProps) {
  const todayId = getTodayDayId();
  const { toast, showToast } = useToast();
  const { attendance, context, choose } = useAttendanceTracker(profile, showToast);
  const trainingDays = WEEKLY_SCHEDULE.filter((day) => day.category !== 'rest').length;

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onBack} />
        <button type="button" className="button button--tracker" onClick={onOpenConsistency}>
          <CalendarCheck2 size={18} aria-hidden="true" />
          Consistency Tracker
        </button>
      </nav>

      <header className="dashboard-header">
        <div className="profile-identity">
          <ProfileAvatar seed={profile.id} name={profile.name} photoDataUrl={profile.photoDataUrl} size={56} />
          <div className="profile-identity__text">
            <span className="profile-identity__name">{profile.name}</span>
            <span className="profile-identity__meta">{getGenderLabel(profile.gender)}</span>
          </div>
        </div>
        <AttendanceQuickLog attendance={attendance} context={context} onChoose={choose} />
        <h1 className="page-title">Weekly Workout Plan</h1>
        <p className="page-subtitle">Stay consistent, one workout at a time.</p>
        <p className="dashboard-header__stats">
          <strong>{trainingDays}</strong> training days · <strong>{7 - trainingDays}</strong> rest day
        </p>
      </header>

      <ul className="legend" aria-label="Workout categories">
        {WORKOUT_CATEGORY_ORDER.map((category) => (
          <li key={category} className="legend__item" data-category={category}>
            <WorkoutIcon category={category} size={14} />
            {WORKOUT_CATEGORIES[category].label}
          </li>
        ))}
      </ul>

      <ul className="week-grid" aria-label="Days of the week">
        {WEEKLY_SCHEDULE.map((day) => (
          <li key={day.id}>
            <DayCard day={day} isToday={day.id === todayId} onSelect={onSelectDay} />
          </li>
        ))}
      </ul>
      <Toast toast={toast} />
    </div>
  );
}
