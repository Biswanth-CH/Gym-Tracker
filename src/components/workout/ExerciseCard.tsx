import { useState } from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { getExerciseImages } from '../../constants/exerciseMedia';
import { getEquipmentNames } from '../../constants/gymEquipment';
import type { LibraryExercise, WorkoutExerciseLog } from '../../types/gym';
import { formatShortDate } from '../../utils/dateUtils';
import { formatSet } from '../../utils/workoutUtils';

const DIFFICULTY_LABEL = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' } as const;

export function formatRecommendation(exercise: LibraryExercise): string {
  const { min, max } = exercise.recommendedRepRange;
  const unit = exercise.measure === 'SECONDS' ? 's' : '';
  return `${exercise.recommendedSets} × ${min}–${max}${unit}`;
}

interface ExerciseCardProps {
  exercise: LibraryExercise;
  lastLog?: WorkoutExerciseLog;
  onSelect: (exercise: LibraryExercise) => void;
}

export function ExerciseCard({ exercise, lastLog, onSelect }: ExerciseCardProps) {
  const images = getExerciseImages(exercise.media);
  const thumbnail = images[images.length - 1];
  const [imageFailed, setImageFailed] = useState(false);
  const completedSets = lastLog?.sets.filter((set) => set.completed) ?? [];
  const lastCompleted = completedSets[completedSets.length - 1];

  return (
    <button type="button" className="exercise-card" onClick={() => onSelect(exercise)} data-exercise={exercise.id}>
      <span className="exercise-card__thumb">
        {thumbnail && !imageFailed ? (
          <img src={thumbnail.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <Dumbbell size={24} aria-hidden="true" />
        )}
      </span>
      <span className="exercise-card__body">
        <span className="exercise-card__name">{exercise.name}</span>
        <span className="exercise-card__equipment">{getEquipmentNames(exercise.equipment).join(' + ')}</span>
        <span className="exercise-card__meta">
          <span className={`pill pill--difficulty pill--${exercise.difficulty.toLowerCase()}`}>{DIFFICULTY_LABEL[exercise.difficulty]}</span>
          <span>{formatRecommendation(exercise)}</span>
        </span>
        {lastLog && (
          <span className="exercise-card__last">
            Last: {formatShortDate(lastLog.date)}
            {lastCompleted ? ` · ${formatSet(lastCompleted, exercise)}` : ''}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="exercise-card__chevron" aria-hidden="true" />
    </button>
  );
}

export { DIFFICULTY_LABEL };
