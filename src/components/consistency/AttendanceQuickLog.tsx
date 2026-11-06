import { useState } from 'react';
import { Check, Moon, X as XIcon } from 'lucide-react';
import type { AttendanceMap, AttendanceStatus, DateKey } from '../../types/gym';
import { getDayState, isMarkableState, type TrackerContext } from '../../utils/consistencyUtils';
import { formatShortDate } from '../../utils/dateUtils';
import { AttendanceModal } from './AttendanceModal';

interface AttendanceQuickLogProps {
  attendance: AttendanceMap;
  context: TrackerContext;
  /** `null` clears today's mark. Should throw / report errors itself. */
  onChoose: (date: DateKey, status: AttendanceStatus | null) => void;
  title?: string;
}

/**
 * "Did you go to the gym today?" — one tap marks today.
 * Tapping the already-selected answer opens the full dialog to change or clear it.
 * Uses the existing attendance storage via the caller's useAttendance hook.
 */
export function AttendanceQuickLog({ attendance, context, onChoose, title = 'Did you go to the gym today?' }: AttendanceQuickLogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { todayKey } = context;
  const state = getDayState(todayKey, attendance, context);
  const status = attendance.get(todayKey);

  if (!isMarkableState(state)) {
    return (
      <section className="today-log" aria-label="Today's attendance">
        <div className="today-log__text today-log__text--rest">
          <Moon size={18} aria-hidden="true" />
          <span>{state === 'sunday' ? 'Sunday is a rest day — nothing to log today.' : 'Attendance can’t be logged for today.'}</span>
        </div>
      </section>
    );
  }

  const handleClick = (choice: AttendanceStatus) => {
    if (status === choice) setIsEditing(true);
    else onChoose(todayKey, choice);
  };

  return (
    <section className="today-log" aria-label="Today's attendance" data-testid="quick-attendance">
      <div className="today-log__text">
        <span className="today-log__label">{title}</span>
        <span className="today-log__date">{formatShortDate(todayKey)}</span>
      </div>
      <div className="today-log__actions">
        <button
          type="button"
          className={`chip-button chip-button--attended${status === 'ATTENDED' ? ' is-active' : ''}`}
          onClick={() => handleClick('ATTENDED')}
          aria-pressed={status === 'ATTENDED'}
        >
          <Check size={16} aria-hidden="true" />
          Went to Gym
        </button>
        <button
          type="button"
          className={`chip-button chip-button--missed${status === 'MISSED' ? ' is-active' : ''}`}
          onClick={() => handleClick('MISSED')}
          aria-pressed={status === 'MISSED'}
        >
          <XIcon size={16} aria-hidden="true" />
          Did Not Go
        </button>
      </div>
      <AttendanceModal
        dateKey={isEditing ? todayKey : null}
        status={status}
        isToday
        onClose={() => setIsEditing(false)}
        onChoose={(choice) => {
          setIsEditing(false);
          onChoose(todayKey, choice);
        }}
      />
    </section>
  );
}
