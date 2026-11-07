import { Check, CalendarDays, Dumbbell, Eraser, Info, X as XIcon } from 'lucide-react';
import type { AttendanceStatus, DateKey } from '../../types/gym';
import { formatLongDate } from '../../utils/dateUtils';
import { Modal } from '../Modal';

export interface DayExerciseItem {
  id: string;
  name: string;
  detail: string;
}

interface AttendanceModalProps {
  dateKey: DateKey | null;
  status: AttendanceStatus | undefined;
  isToday: boolean;
  /** False for Sundays and days before the tracking start date. */
  canMark?: boolean;
  markNote?: string;
  /** Exercise variations selected on this date; omit to hide the section. */
  exercises?: DayExerciseItem[];
  onClose: () => void;
  /** `null` clears the mark. */
  onChoose: (status: AttendanceStatus | null) => void;
}

const STATUS_TEXT: Record<AttendanceStatus | 'NONE', string> = {
  ATTENDED: 'Went to gym',
  MISSED: 'Did not go',
  NONE: 'Not marked',
};

export function AttendanceModal({ dateKey, status, isToday, canMark = true, markNote, exercises, onClose, onChoose }: AttendanceModalProps) {
  const currentKey = status ?? 'NONE';

  return (
    <Modal
      isOpen={dateKey !== null}
      onClose={onClose}
      title={dateKey ? `${formatLongDate(dateKey)}` : ''}
      description={isToday ? 'Today · Workout details' : 'Workout details'}
      icon={<CalendarDays size={24} aria-hidden="true" />}
    >
      <p className="attendance-status">
        Attendance:{' '}
        <span className={`status-pill status-pill--${currentKey.toLowerCase()}`} data-testid="day-attendance">
          {STATUS_TEXT[currentKey]}
        </span>
      </p>

      {exercises && (
        <section className="day-exercises" aria-label="Exercises recorded for this day" data-testid="day-exercises">
          <h3 className="day-exercises__title">
            <Dumbbell size={16} aria-hidden="true" /> Exercises
          </h3>
          {exercises.length > 0 ? (
            <ul className="day-exercises__list">
              {exercises.map((exercise) => (
                <li key={exercise.id}>
                  <strong>{exercise.name}</strong>
                  <span>{exercise.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="day-exercises__empty">No exercise variations were recorded for this day.</p>
          )}
        </section>
      )}

      {canMark ? (
        <div className="attendance-options" role="group" aria-label="Set attendance">
          <button
            type="button"
            className={`attendance-option attendance-option--attended${status === 'ATTENDED' ? ' is-active' : ''}`}
            onClick={() => onChoose('ATTENDED')}
            aria-pressed={status === 'ATTENDED'}
            data-autofocus
          >
            <span className="attendance-option__icon">
              <Check size={20} aria-hidden="true" />
            </span>
            Went to Gym
          </button>
          <button
            type="button"
            className={`attendance-option attendance-option--missed${status === 'MISSED' ? ' is-active' : ''}`}
            onClick={() => onChoose('MISSED')}
            aria-pressed={status === 'MISSED'}
          >
            <span className="attendance-option__icon">
              <XIcon size={20} aria-hidden="true" />
            </span>
            Did Not Go
          </button>
          <button type="button" className="attendance-option attendance-option--clear" onClick={() => onChoose(null)} disabled={status === undefined}>
            <span className="attendance-option__icon">
              <Eraser size={20} aria-hidden="true" />
            </span>
            Clear Mark
          </button>
        </div>
      ) : (
        <p className="info-note info-note--inline">
          <Info size={16} aria-hidden="true" />
          <span>{markNote ?? 'Attendance can’t be marked for this day.'}</span>
        </p>
      )}
    </Modal>
  );
}
