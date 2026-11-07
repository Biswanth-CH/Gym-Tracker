import { ChevronRight } from 'lucide-react';
import { WORKOUT_CATEGORIES, getDayMuscleLabels } from '../constants/workoutSchedule';
import type { WorkoutDay } from '../types/gym';
import { WorkoutIcon } from './WorkoutIcon';

interface DayCardProps {
  day: WorkoutDay;
  isToday: boolean;
  onSelect: (day: WorkoutDay) => void;
}

export function DayCard({ day, isToday, onSelect }: DayCardProps) {
  const category = WORKOUT_CATEGORIES[day.category];

  return (
    <button
      type="button"
      className={`day-card${isToday ? ' day-card--today' : ''}`}
      data-category={day.category}
      onClick={() => onSelect(day)}
      aria-label={`${day.dayName}: ${category.label}, ${getDayMuscleLabels(day).join(', ')}${isToday ? ' (today)' : ''}`}
    >
      <span className="day-card__top">
        <span className="category-icon">
          <WorkoutIcon category={day.category} size={18} />
        </span>
        {isToday && <span className="day-card__today">Today</span>}
      </span>
      <span className="day-card__day">{day.dayName}</span>
      <span className="day-card__category">{category.label}</span>
      <span className="day-card__muscles">{getDayMuscleLabels(day).join(' · ')}</span>
      <span className="day-card__chevron" aria-hidden="true">
        <ChevronRight size={18} />
      </span>
    </button>
  );
}
