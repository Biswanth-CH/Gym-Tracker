import { Check, Circle, History } from 'lucide-react';
import type { LibraryExercise, WorkoutExerciseLog } from '../../types/gym';
import { formatShortDate } from '../../utils/dateUtils';
import { formatSet } from '../../utils/workoutUtils';

interface PreviousWorkoutSummaryProps {
  exercise: LibraryExercise;
  previous: WorkoutExerciseLog | null;
  onUseAsStart: () => void;
}

/** The most recent session before the selected date. */
export function PreviousWorkoutSummary({ exercise, previous, onUseAsStart }: PreviousWorkoutSummaryProps) {
  return (
    <section className="detail-card previous" aria-labelledby="previous-heading" data-testid="previous-summary">
      <h2 id="previous-heading" className="detail-card__title previous__title">
        <History size={16} aria-hidden="true" /> Previous session
      </h2>
      {previous ? (
        <>
          <p className="previous__date">{formatShortDate(previous.date)}</p>
          <ol className="previous__sets">
            {previous.sets.map((set) => (
              <li key={set.id} className={set.completed ? 'is-completed' : ''}>
                <span className="previous__set-number">Set {set.setNumber}</span>
                <span>{formatSet(set, exercise)}</span>
                {set.completed ? (
                  <Check size={14} aria-label="completed" />
                ) : (
                  <Circle size={12} aria-label="not completed" />
                )}
              </li>
            ))}
          </ol>
          <button type="button" className="button button--ghost button--compact previous__use" onClick={onUseAsStart}>
            Use these as a starting point
          </button>
        </>
      ) : (
        <p className="detail-card__text">No earlier session for this exercise yet.</p>
      )}
    </section>
  );
}
