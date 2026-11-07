import { Check, Circle, X as XIcon } from 'lucide-react';
import type { AttendanceMap, AttendanceStatus, DateKey } from '../../types/gym';
import { getDayState, isMarkableState, type TrackerContext } from '../../utils/consistencyUtils';

interface CompactAttendanceProps {
  attendance: AttendanceMap;
  context: TrackerContext;
  onChoose: (date: DateKey, status: AttendanceStatus | null) => void;
}

/** Small today-only attendance control. Uses the shared attendance service through `onChoose`. */
export function CompactAttendance({ attendance, context, onChoose }: CompactAttendanceProps) {
  const { todayKey } = context;
  const state = getDayState(todayKey, attendance, context);
  const status = attendance.get(todayKey);

  if (!isMarkableState(state)) {
    return (
      <p className="compact-attendance compact-attendance--rest" role="status">
        {state === 'sunday' ? 'Sunday is a rest day.' : 'Attendance can’t be logged today.'}
      </p>
    );
  }

  const choose = (next: AttendanceStatus | null) => onChoose(todayKey, next);

  return (
    <section className="compact-attendance" aria-label="Today's attendance" data-testid="compact-attendance">
      <p className="compact-attendance__title">Eeroju Gym ki ellava?</p>
      <div className="compact-attendance__actions">
        <button
          type="button"
          className={`icon-toggle icon-toggle--attended${status === 'ATTENDED' ? ' is-active' : ''}`}
          aria-label="Went to Gym"
          aria-pressed={status === 'ATTENDED'}
          title="Went to Gym"
          onClick={() => choose('ATTENDED')}
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`icon-toggle icon-toggle--missed${status === 'MISSED' ? ' is-active' : ''}`}
          aria-label="Did Not Go"
          aria-pressed={status === 'MISSED'}
          title="Did Not Go"
          onClick={() => choose('MISSED')}
        >
          <XIcon size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-toggle icon-toggle--clear"
          aria-label="Clear Mark"
          title="Clear Mark"
          disabled={!status}
          onClick={() => choose(null)}
        >
          <Circle size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
