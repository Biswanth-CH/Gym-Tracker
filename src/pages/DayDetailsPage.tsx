import { ChevronLeft, ChevronRight, ClipboardList, Droplets, BedDouble, StretchHorizontal } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { WorkoutIcon } from '../components/WorkoutIcon';
import { WEEKLY_SCHEDULE, WORKOUT_CATEGORIES, getTodayDayId } from '../constants/workoutSchedule';
import type { Profile, WorkoutDay } from '../types/gym';

interface DayDetailsPageProps {
  profile: Profile;
  day: WorkoutDay;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
}

const RECOVERY_TIPS = [
  { icon: BedDouble, label: 'Sleep 7–9 hours' },
  { icon: Droplets, label: 'Stay hydrated' },
  { icon: StretchHorizontal, label: 'Light stretching' },
] as const;

export function DayDetailsPage({ profile, day, onBack, onSelectDay }: DayDetailsPageProps) {
  const category = WORKOUT_CATEGORIES[day.category];
  const isRestDay = day.category === 'rest';
  const isToday = day.id === getTodayDayId();

  const dayIndex = WEEKLY_SCHEDULE.findIndex((scheduleDay) => scheduleDay.id === day.id);
  const previousDay = WEEKLY_SCHEDULE[(dayIndex + WEEKLY_SCHEDULE.length - 1) % WEEKLY_SCHEDULE.length];
  const nextDay = WEEKLY_SCHEDULE[(dayIndex + 1) % WEEKLY_SCHEDULE.length];

  return (
    <div className="page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
        <span className="top-bar__context">{profile.name}</span>
      </nav>

      <section className="day-hero" data-category={day.category} aria-labelledby="day-heading">
        <div className="day-hero__badge-row">
          <span className="pill pill--accent">{category.label}</span>
          {isToday && <span className="pill">Today</span>}
        </div>
        <h1 id="day-heading" className="day-hero__day">
          {day.dayName}
        </h1>
        <p className="day-hero__tagline">{category.tagline}</p>
        <div className="day-hero__icon" aria-hidden="true">
          <WorkoutIcon category={day.category} size={72} />
        </div>
      </section>

      <section className="detail-card" aria-labelledby="muscles-heading">
        <h2 id="muscles-heading" className="detail-card__title">
          {isRestDay ? 'Focus' : 'Target muscle groups'}
        </h2>
        <ul className="chip-list" data-category={day.category}>
          {day.muscleGroups.map((muscle) => (
            <li key={muscle} className="chip">
              {muscle}
            </li>
          ))}
        </ul>
        <p className="detail-card__text">{category.description}</p>
      </section>

      {isRestDay ? (
        <section className="detail-card" aria-labelledby="recovery-heading">
          <h2 id="recovery-heading" className="detail-card__title">
            Recovery checklist
          </h2>
          <ul className="tip-list">
            {RECOVERY_TIPS.map(({ icon: Icon, label }) => (
              <li key={label} className="tip-list__item" data-category="rest">
                <span className="category-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="detail-card detail-card--placeholder" aria-labelledby="exercises-heading">
          <ClipboardList size={28} aria-hidden="true" />
          <h2 id="exercises-heading" className="detail-card__title">
            Exercises
          </h2>
          <p className="detail-card__text">
            Exercise tracking with sets, reps and weight is coming soon.
          </p>
        </section>
      )}

      <nav className="day-switcher" aria-label="Other days">
        <button type="button" className="button button--ghost" onClick={() => onSelectDay(previousDay)}>
          <ChevronLeft size={18} aria-hidden="true" />
          {previousDay.dayName}
        </button>
        <button type="button" className="button button--ghost" onClick={() => onSelectDay(nextDay)}>
          {nextDay.dayName}
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
