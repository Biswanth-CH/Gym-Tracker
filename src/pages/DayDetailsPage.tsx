import { useState } from 'react';
import { BedDouble, ChevronDown, Droplets, StretchHorizontal } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { MuscleGroupCard } from '../components/workout/MuscleCards';
import { StretchSection } from '../components/stretch/StretchSection';
import { REST_DAY_RECOVERY } from '../constants/stretches';
import { MUSCLE_GROUPS_BY_ID } from '../constants/muscleGroups';
import { REST_DAY_LABEL, WORKOUT_CATEGORIES, getTodayDayId } from '../constants/workoutSchedule';
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

function StretchToggle({ label, isOpen, controls, onToggle }: { label: string; isOpen: boolean; controls: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`button button--ghost stretch-toggle${isOpen ? ' is-active' : ''}`}
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={onToggle}
    >
      {label}
      <ChevronDown size={16} className="stretch-toggle__chevron" aria-hidden="true" />
    </button>
  );
}

/**
 * One day of the active split. Everything shown is derived from `day.muscleGroupIds`
 * (built-in PPL or any saved custom split) — nothing is hard-coded per weekday.
 */
export function DayDetailsPage({ day, onBack, onSelectMuscleGroup }: DayDetailsPageProps) {
  const isRestDay = day.muscleGroupIds.length === 0 || day.category === 'rest';
  const isToday = day.id === getTodayDayId();
  const workoutName = day.title ?? WORKOUT_CATEGORIES[day.category].label;
  const muscleGroups = day.muscleGroupIds.map((id) => MUSCLE_GROUPS_BY_ID[id]);
  const preWorkout = stretchesForMuscleGroups(day.muscleGroupIds, 'WARMUP');
  const postWorkout = stretchesForMuscleGroups(day.muscleGroupIds, 'COOLDOWN');
  const [pane, setPane] = useState<StretchPane>(null);
  const toggle = (next: StretchPane) => setPane((current) => (current === next ? null : next));

  return (
    <div className="page" data-category={day.category}>
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
      </nav>

      <header className="day-heading" aria-labelledby="day-heading">
        <p className="day-heading__workout">
          {workoutName}
          {isToday && <span className="pill day-heading__today">Today</span>}
        </p>
        <h1 id="day-heading" className="page-title">
          {day.dayName}
        </h1>
        <p className="day-heading__muscles" data-testid="day-muscles">
          {isRestDay ? REST_DAY_LABEL : muscleGroups.map((group) => group.name).join(' • ')}
        </p>
      </header>

      {isRestDay ? (
        <>
          <div className="stretch-toggle-row stretch-toggle-row--single">
            <StretchToggle label="Recovery Stretches" isOpen={pane === 'recovery'} controls="rest-recovery" onToggle={() => toggle('recovery')} />
          </div>
          {pane === 'recovery' && (
            <StretchSection
              id="rest-recovery"
              title="Rest & Recovery Routine (optional)"
              intro="Gentle movement to help you feel loose for tomorrow. Skip it if you prefer full rest."
              stretches={REST_DAY_RECOVERY}
            />
          )}
          <ul className="tip-list day-heading__tips">
            {RECOVERY_TIPS.map(({ icon: Icon, label }) => (
              <li key={label} className="tip-list__item" data-category="rest">
                <span className="category-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="stretch-toggle-row" role="group" aria-label="Stretches">
            <StretchToggle label="Pre-Workout Stretches" isOpen={pane === 'pre'} controls="pre-workout" onToggle={() => toggle('pre')} />
            <StretchToggle label="Post-Workout Stretches" isOpen={pane === 'post'} controls="post-workout" onToggle={() => toggle('post')} />
          </div>
          {pane === 'pre' && (
            <StretchSection
              id="pre-workout"
              title="Pre-Workout Stretches"
              intro="Dynamic warm-up for today’s muscles. Keep moving through each drill."
              stretches={preWorkout}
            />
          )}
          {pane === 'post' && (
            <StretchSection
              id="post-workout"
              title="Post-Workout Stretches"
              intro="Static cooldown holds once you’re finished. Mild tension, never pain."
              stretches={postWorkout}
            />
          )}
          <section className="section day-muscle-section" aria-labelledby="train-heading">
            <h2 id="train-heading" className="section__title">
              Choose Muscle Group
            </h2>
            <ul className="card-list">
              {muscleGroups.map((group) => (
                <li key={group.id}>
                  <MuscleGroupCard group={group} onSelect={onSelectMuscleGroup} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
