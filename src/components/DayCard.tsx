import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { WORKOUT_CATEGORIES } from '../constants/workoutSchedule';
import type { CardBackgroundSettings, WorkoutDay } from '../types/gym';
import { CardBackgroundLayers } from './cardBackground/CardBackgroundLayers';

interface DayCardProps {
  day: WorkoutDay;
  isToday: boolean;
  onSelect: (day: WorkoutDay) => void;
  /** Phase 7: this profile's background for this weekday (image URL + appearance). */
  background?: { imageUrl: string | null; settings: CardBackgroundSettings } | null;
  /** Renders a non-interactive copy (Customize Card Background preview). */
  isPreview?: boolean;
}

export function DayCard({ day, isToday, onSelect, background = null, isPreview = false }: DayCardProps) {
  const category = WORKOUT_CATEGORIES[day.category];
  const categoryLabel = day.title ?? category.label;
  const hasBackground = Boolean(background?.imageUrl);
  const className = `day-card${isToday ? ' day-card--today' : ''}${hasBackground ? ' has-card-background' : ''}`;
  const content: ReactNode = (
    <>
      {background?.imageUrl && <CardBackgroundLayers imageUrl={background.imageUrl} settings={background.settings} />}
      {isToday && (
        <span className="day-card__top">
          <span className="day-card__today">Today</span>
        </span>
      )}
      {/* Only the day and its workout name, at the bottom-left (muscle groups live on the day page). */}
      <span className="day-card__text">
        <span className="day-card__day">{day.dayName}</span>
        <span className="day-card__category">{categoryLabel}</span>
      </span>
      <span className="day-card__chevron" aria-hidden="true">
        <ChevronRight size={18} />
      </span>
    </>
  );

  if (isPreview) {
    return (
      <div className={className} data-category={day.category} data-testid="day-card-preview">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-category={day.category}
      onClick={() => onSelect(day)}
      aria-label={`${day.dayName}: ${categoryLabel}${isToday ? ' (today)' : ''}`}
      data-testid={`day-card-${day.id}`}
    >
      {content}
    </button>
  );
}
