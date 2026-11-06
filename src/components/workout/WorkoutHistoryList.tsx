import { Pencil, Trash2, Trophy } from 'lucide-react';
import type { DateKey, LibraryExercise, WorkoutExerciseLog } from '../../types/gym';
import { formatShortDate } from '../../utils/dateUtils';
import { formatSet } from '../../utils/workoutUtils';

interface WorkoutHistoryListProps {
  exercise: LibraryExercise;
  logs: WorkoutExerciseLog[];
  prSessionDates: ReadonlySet<DateKey>;
  selectedDate: DateKey;
  onEdit: (date: DateKey) => void;
  onDelete: (date: DateKey) => void;
}

export function WorkoutHistoryList({ exercise, logs, prSessionDates, selectedDate, onEdit, onDelete }: WorkoutHistoryListProps) {
  if (logs.length === 0) return null;
  return (
    <section className="section history" aria-labelledby="history-heading">
      <h2 id="history-heading" className="section__title history__title">
        History
      </h2>
      <ul className="history__list">
        {logs.map((log) => {
          const completed = log.sets.filter((set) => set.completed);
          return (
            <li key={log.id} className={`history__item${log.date === selectedDate ? ' is-selected' : ''}`} data-date={log.date}>
              <div className="history__head">
                <span className="history__date">{formatShortDate(log.date)}</span>
                {prSessionDates.has(log.date) && (
                  <span className="pr-badge" data-testid="history-pr">
                    <Trophy size={12} aria-hidden="true" /> PR
                  </span>
                )}
                <span className="history__actions">
                  <button type="button" className="icon-button" onClick={() => onEdit(log.date)} aria-label={`Edit session from ${formatShortDate(log.date)}`}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => onDelete(log.date)}
                    aria-label={`Delete session from ${formatShortDate(log.date)}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <p className="history__sets">
                {completed.length > 0 ? completed.map((set) => formatSet(set, exercise)).join(' · ') : 'No completed sets'}
                {log.sets.length > completed.length && (
                  <span className="history__planned"> (+{log.sets.length - completed.length} not completed)</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
