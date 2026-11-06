import { BedDouble, Droplets, StretchHorizontal } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { WorkoutIcon } from '../components/WorkoutIcon';
import { MuscleGroupCard } from '../components/workout/MuscleCards';
import { MUSCLE_GROUPS_BY_ID } from '../constants/muscleGroups';
import { REST_DAY_LABEL, WORKOUT_CATEGORIES, getDayMuscleLabels, getTodayDayId } from '../constants/workoutSchedule';
import type { MuscleGroup, Profile, WorkoutDay } from '../types/gym';

interface DayDetailsPageProps {
  profile: Profile;
  day: WorkoutDay;
  onBack: () => void;
  onSelectMuscleGroup: (group: MuscleGroup) => void;
}

const RECOVERY_TIPS = [
  { icon: BedDouble, label: 'Sleep 7–9 hours' },
  { icon: Droplets, label: 'Stay hydrated' },
  { icon: StretchHorizontal, label: 'Light stretching' },
] as const;

export function DayDetailsPage({ profile, day, onBack, onSelectMuscleGroup }: DayDetailsPageProps) {
  const category = WORKOUT_CATEGORIES[day.category];
  const isRestDay = day.category === 'rest';
  const isToday = day.id === getTodayDayId();

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
          {isRestDay ? 'Focus' : 'Muscle groups'}
        </h2>
        <ul className="chip-list" data-category={day.category}>
          {getDayMuscleLabels(day).map((muscle) => (
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
            {REST_DAY_LABEL}
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
        <section className="section" aria-labelledby="train-heading">
          <h2 id="train-heading" className="section__title">
            Choose a muscle group
          </h2>
          <ul className="card-list">
            {day.muscleGroupIds.map((id) => (
              <li key={id}>
                <MuscleGroupCard group={MUSCLE_GROUPS_BY_ID[id]} onSelect={onSelectMuscleGroup} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
