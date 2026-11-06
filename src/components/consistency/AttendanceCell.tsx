import { memo } from 'react';
import type { DateKey } from '../../types/gym';
import { isMarkableState, type DayState } from '../../utils/consistencyUtils';
import { formatShortDate } from '../../utils/dateUtils';
import { DAY_STATE_LABELS } from './attendanceLabels';

interface AttendanceCellProps {
  dateKey: DateKey;
  state: DayState;
  isToday: boolean;
  onSelect: (dateKey: DateKey) => void;
}

/** One day square. Only markable days (Mon–Sat, tracked, not future) are clickable. */
export const AttendanceCell = memo(function AttendanceCell({ dateKey, state, isToday, onSelect }: AttendanceCellProps) {
  const label = `${formatShortDate(dateKey)}: ${DAY_STATE_LABELS[state]}${isToday ? ' (today)' : ''}`;
  const className = `heatmap__cell heatmap__cell--${state}${isToday ? ' heatmap__cell--today' : ''}`;

  if (!isMarkableState(state)) {
    return <span className={className} role="img" aria-label={label} title={label} data-date={dateKey} />;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(dateKey)}
      aria-label={label}
      title={label}
      data-date={dateKey}
    />
  );
});
