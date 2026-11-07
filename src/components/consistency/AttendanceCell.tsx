import { memo } from 'react';
import type { DateKey } from '../../types/gym';
import type { DayState } from '../../utils/consistencyUtils';
import { formatShortDate } from '../../utils/dateUtils';
import { DAY_STATE_LABELS } from './attendanceLabels';

interface AttendanceCellProps {
  dateKey: DateKey;
  state: DayState;
  isToday: boolean;
  /** Number of exercise variations selected on this date. */
  workoutCount: number;
  onSelect: (dateKey: DateKey) => void;
}

/**
 * One day square. Every non-future day opens its workout details; whether
 * attendance can be changed is decided in the dialog (Mon–Sat, tracked days).
 */
export const AttendanceCell = memo(function AttendanceCell({ dateKey, state, isToday, workoutCount, onSelect }: AttendanceCellProps) {
  const workoutText = workoutCount > 0 ? `, ${workoutCount} exercise${workoutCount === 1 ? '' : 's'}` : '';
  const label = `${formatShortDate(dateKey)}: ${DAY_STATE_LABELS[state]}${workoutText}${isToday ? ' (today)' : ''}`;
  const className = `heatmap__cell heatmap__cell--${state}${isToday ? ' heatmap__cell--today' : ''}${workoutCount > 0 ? ' heatmap__cell--has-workout' : ''}`;

  if (state === 'future') {
    return <span className={className} role="img" aria-label={label} title={label} data-date={dateKey} />;
  }

  return (
    <button type="button" className={className} onClick={() => onSelect(dateKey)} aria-label={label} title={label} data-date={dateKey} />
  );
});
