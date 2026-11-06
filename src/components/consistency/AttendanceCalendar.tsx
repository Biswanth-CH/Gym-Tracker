import { useLayoutEffect, useMemo, useRef } from 'react';
import type { AttendanceMap, DateKey } from '../../types/gym';
import {
  buildCalendarGrid,
  getDayState,
  type MonthInfo,
  type TrackerContext,
} from '../../utils/consistencyUtils';
import { AttendanceCell } from './AttendanceCell';
import { DAY_STATE_LABELS, LEGEND_ORDER } from './attendanceLabels';

interface AttendanceCalendarProps {
  months: MonthInfo[];
  attendance: AttendanceMap;
  context: TrackerContext;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  onSelectDate: (dateKey: DateKey) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Contribution-style heatmap: one column per week (Monday → Sunday rows),
 * month labels on top, weekday labels pinned on the left. Only this
 * container scrolls horizontally on narrow screens — never the page.
 */
export function AttendanceCalendar({
  months,
  attendance,
  context,
  selectedMonthKey,
  onSelectMonth,
  onSelectDate,
}: AttendanceCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const grid = useMemo(() => buildCalendarGrid(months), [months]);

  // Keep the selected month in view (on first render that is the current
  // month, so the graph opens on the most recent weeks, like a timeline).
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const label = container?.querySelector<HTMLElement>(`[data-month="${selectedMonthKey}"]`);
    if (!container || !label) return;
    const target = label.offsetLeft - container.clientWidth / 2 + label.offsetWidth * 2;
    container.scrollLeft = Math.max(0, Math.min(target, container.scrollWidth - container.clientWidth));
  }, [grid, selectedMonthKey]);

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-scroll" ref={scrollRef} tabIndex={0} aria-label="Attendance calendar, scroll sideways for earlier months">
        <div className="heatmap" style={{ ['--weeks' as string]: grid.weeks.length }}>
          <div className="heatmap__corner" aria-hidden="true" />
          <div className="heatmap__months">
            {grid.monthStarts.map(({ month, column }) => (
              <button
                key={month.key}
                data-month={month.key}
                type="button"
                className={`heatmap__month${month.key === selectedMonthKey ? ' is-selected' : ''}`}
                style={{ gridColumn: `${column + 1} / span 4` }}
                onClick={() => onSelectMonth(month.key)}
                aria-pressed={month.key === selectedMonthKey}
                aria-label={`Show statistics for ${month.label} ${month.year}`}
              >
                {month.shortLabel}
              </button>
            ))}
          </div>
          <div className="heatmap__weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="heatmap__grid">
            {grid.weeks.flatMap((week, weekIndex) =>
              week.map((dateKey, dayIndex) =>
                dateKey ? (
                  <AttendanceCell
                    key={dateKey}
                    dateKey={dateKey}
                    state={getDayState(dateKey, attendance, context)}
                    isToday={dateKey === context.todayKey}
                    onSelect={onSelectDate}
                  />
                ) : (
                  <span key={`pad-${weekIndex}-${dayIndex}`} className="heatmap__cell heatmap__cell--pad" aria-hidden="true" />
                ),
              ),
            )}
          </div>
        </div>
      </div>

      <ul className="heatmap-legend" aria-label="Legend">
        {LEGEND_ORDER.map((state) => (
          <li key={state}>
            <span className={`heatmap__cell heatmap__cell--${state}`} aria-hidden="true" />
            {state === 'future' ? 'Future / not tracked' : DAY_STATE_LABELS[state]}
          </li>
        ))}
      </ul>
    </div>
  );
}
