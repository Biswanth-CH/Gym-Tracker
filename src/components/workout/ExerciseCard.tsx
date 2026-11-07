import { useState } from 'react';
import { CalendarCheck2, ChevronRight, Dumbbell, Trophy } from 'lucide-react';
import { getExerciseImages } from '../../constants/exerciseMedia';
import { getEquipmentNames } from '../../constants/gymEquipment';
import type { LibraryExercise, PersonalRecord } from '../../types/gym';
import { formatSet } from '../../utils/workoutUtils';

const DIFFICULTY_LABEL = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' } as const;

export function formatRecommendation(exercise: LibraryExercise): string {
  const { min, max } = exercise.recommendedRepRange;
  const unit = exercise.measure === 'SECONDS' ? 's' : '';
  return `${exercise.recommendedSets} × ${min}–${max}${unit}`;
}

interface ExerciseCardProps {
  exercise: LibraryExercise;
  record?: PersonalRecord;
  selectedToday?: boolean;
  onSelect: (exercise: LibraryExercise) => void;
}

export function ExerciseCard({ exercise, record, selectedToday = false, onSelect }: ExerciseCardProps) {
  const images = getExerciseImages(exercise.media);
  const thumbnail = images[images.length - 1];
  const [imageFailed, setImageFailed] = useState(false);

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
        {(record || selectedToday) && (
          <span className="exercise-card__last">
            {selectedToday && (
              <span className="exercise-card__today">
                <CalendarCheck2 size={13} aria-hidden="true" /> Today
              </span>
            )}
            {record && (
              <span>
                <Trophy size={13} aria-hidden="true" /> PR {formatSet({ weight: record.weight, weightUnit: record.unit, repetitions: record.reps }, exercise)}
              </span>
            )}
          </span>
        )}
      </span>
      <ChevronRight size={18} className="exercise-card__chevron" aria-hidden="true" />
    </button>
  );
}

export { DIFFICULTY_LABEL };
