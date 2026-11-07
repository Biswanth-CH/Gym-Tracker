import { useState } from 'react';
import { BedDouble, Droplets, StretchHorizontal } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { WorkoutIcon } from '../components/WorkoutIcon';
import { MuscleGroupCard } from '../components/workout/MuscleCards';
import { StretchSection } from '../components/stretch/StretchSection';
import { REST_DAY_RECOVERY } from '../constants/stretches';
import { MUSCLE_GROUPS_BY_ID } from '../constants/muscleGroups';
import { REST_DAY_LABEL, WORKOUT_CATEGORIES, getDayMuscleLabels, getTodayDayId } from '../constants/workoutSchedule';
import type { MuscleGroup, Profile, WorkoutDay } from '../types/gym';
import { stretchesForMuscleGroups } from '../utils/stretchPlan';

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

type StretchPane = 'pre' | 'post' | 'recovery' | null;

export function DayDetailsPage({ profile, day, onBack, onSelectMuscleGroup }: DayDetailsPageProps) {
  const category = WORKOUT_CATEGORIES[day.category];
  const isRestDay = day.muscleGroupIds.length === 0 || day.category === 'rest';
  const isToday = day.id === getTodayDayId();
  const heading = day.title ?? category.label;
  const pre = stretchesForMuscleGroups(day.muscleGroupIds, 'WARMUP');
  const post = stretchesForMuscleGroups(day.muscleGroupIds, 'COOLDOWN');
  const [pane, setPane] = useState<StretchPane>(null);
  const toggle = (next: StretchPane) => setPane((current) => (current === next ? null : next));

  return (
    <div className="page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
        <span className="top-bar__context">{profile.name}</span>
      </nav>

      <section className="day-hero" data-category={day.category} aria-labelledby="day-heading">
        <div className="day-hero__badge-row">
          <span className="pill pill--accent">{heading}</span>
          {isToday && <span className="pill">Today</span>}
        </div>
        <h1 id="day-heading" className="day-hero__day">
          {day.dayName}
        </h1>
        <p className="day-hero__tagline">{day.title ? getDayMuscleLabels(day).join(' · ') : category.tagline}</p>
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
        {!day.title && <p className="detail-card__text">{category.description}</p>}
      </section>

      {isRestDay ? (
        <>
          <div className="stretch-toggle-row">
            <button type="button" className={`button button--ghost${pane === 'recovery' ? ' is-active' : ''}`} aria-expanded={pane === 'recovery'} onClick={() => toggle('recovery')}>
              Recovery stretches
            </button>
          </div>
          {pane === 'recovery' && (
            <StretchSection
              id="rest-recovery"
              title="Rest & Recovery Routine (optional)"
              intro="Gentle movement to help you feel loose for tomorrow. Skip it if you prefer full rest."
              stretches={REST_DAY_RECOVERY}
            />
          )}
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
        </>
      ) : (
        <>
          <div className="stretch-toggle-row" role="group" aria-label="Stretches">
            <button type="button" className={`button button--ghost${pane === 'pre' ? ' is-active' : ''}`} aria-expanded={pane === 'pre'} onClick={() => toggle('pre')}>
              Pre-Workout Stretches
            </button>
            <button type="button" className={`button button--ghost${pane === 'post' ? ' is-active' : ''}`} aria-expanded={pane === 'post'} onClick={() => toggle('post')}>
              Post-Workout Stretches
            </button>
          </div>
          {pane === 'pre' && (
            <StretchSection
              id="pre-workout"
              title="Pre-Workout Stretches"
              intro="Dynamic warm-up for today’s muscles. Move through each drill instead of holding a long stretch before lifting."
              stretches={pre}
            />
          )}
          {pane === 'post' && (
            <StretchSection
              id="post-workout"
              title="Post-Workout Stretches"
              intro="Static cooldown holds once you’re finished. Ease into each stretch; mild tension, never pain."
              stretches={post}
            />
          )}
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
        </>
      )}
      <p className="disclaimer">General mobility suggestions, not medical advice.</p>
    </div>
  );
}
