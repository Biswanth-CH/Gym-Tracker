import { Check, CalendarDays, Eraser, X as XIcon } from 'lucide-react';
import type { AttendanceStatus, DateKey } from '../../types/gym';
import { formatLongDate } from '../../utils/dateUtils';
import { Modal } from '../Modal';

interface AttendanceModalProps {
  dateKey: DateKey | null;
  status: AttendanceStatus | undefined;
  isToday: boolean;
  onClose: () => void;
  /** `null` clears the mark. */
  onChoose: (status: AttendanceStatus | null) => void;
}

const STATUS_TEXT: Record<AttendanceStatus | 'NONE', string> = {
  ATTENDED: 'Went to gym',
  MISSED: 'Did not go',
  NONE: 'Not marked',
};

export function AttendanceModal({ dateKey, status, isToday, onClose, onChoose }: AttendanceModalProps) {
  const currentKey = status ?? 'NONE';

  return (
    <Modal
      isOpen={dateKey !== null}
      onClose={onClose}
      title={dateKey ? formatLongDate(dateKey) : ''}
      description={isToday ? 'Today' : 'Log or change your attendance for this day.'}
      icon={<CalendarDays size={24} aria-hidden="true" />}
    >
      <p className="attendance-status">
        Current status:{' '}
        <span className={`status-pill status-pill--${currentKey.toLowerCase()}`}>{STATUS_TEXT[currentKey]}</span>
      </p>

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
        <button
          type="button"
          className="attendance-option attendance-option--clear"
          onClick={() => onChoose(null)}
          disabled={status === undefined}
        >
          <span className="attendance-option__icon">
            <Eraser size={20} aria-hidden="true" />
          </span>
          Clear Mark
        </button>
      </div>
    </Modal>
  );
}
