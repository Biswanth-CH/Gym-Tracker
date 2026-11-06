import { BackButton } from '../components/BackButton';
import { DayCard } from '../components/DayCard';
import { WorkoutIcon } from '../components/WorkoutIcon';
import {
  WEEKLY_SCHEDULE,
  WORKOUT_CATEGORIES,
  WORKOUT_CATEGORY_ORDER,
  getTodayDayId,
} from '../constants/workoutSchedule';
import type { Profile, WorkoutDay } from '../types/gym';
import { getAvatarGradient, getInitials } from '../utils/profileUtils';

interface ProfileDashboardProps {
  profile: Profile;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
}

export function ProfileDashboard({ profile, onBack, onSelectDay }: ProfileDashboardProps) {
  const todayId = getTodayDayId();
  const trainingDays = WEEKLY_SCHEDULE.filter((day) => day.category !== 'rest').length;

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onBack} />
      </nav>

      <header className="dashboard-header">
        <div className="profile-chip">
          <span className="profile-chip__avatar" style={{ background: getAvatarGradient(profile.id) }} aria-hidden="true">
            {getInitials(profile.name)}
          </span>
          <span className="profile-chip__name">{profile.name}</span>
        </div>
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
    </div>
  );
}
