import { Trophy } from 'lucide-react';
import type { LibraryExercise, WeightUnit } from '../../types/gym';
import { formatShortDate } from '../../utils/dateUtils';
import type { PersonalRecords, RecordSet } from '../../utils/personalRecords';
import { formatNumber, formatSet, fromKg, unitLabel } from '../../utils/workoutUtils';

interface PersonalRecordCardProps {
  exercise: LibraryExercise;
  records: PersonalRecords;
  /** Unit to display converted weights in. */
  displayUnit: WeightUnit;
}

function Row({ label, set, exercise, extra }: { label: string; set: RecordSet; exercise: LibraryExercise; extra?: string }) {
  return (
    <div className="pr-card__row">
      <dt>{label}</dt>
      <dd>
        <strong>{formatSet(set, exercise)}</strong>
        {extra && <span className="pr-card__extra">{extra}</span>}
        <span className="pr-card__date">{formatShortDate(set.date)}</span>
      </dd>
    </div>
  );
}

export function PersonalRecordCard({ exercise, records, displayUnit }: PersonalRecordCardProps) {
  const isWeightedReps = exercise.loadType === 'WEIGHTED' && exercise.measure === 'REPS';
  const e1rm = records.bestEstimatedOneRepMax?.estimatedOneRepMaxKg ?? null;
  const amountWord = exercise.measure === 'SECONDS' ? 'Longest hold' : 'Most reps';

  return (
    <section className="detail-card pr-card" aria-labelledby="pr-heading" data-testid="pr-card">
      <h2 id="pr-heading" className="detail-card__title pr-card__title">
        <Trophy size={16} aria-hidden="true" /> Personal records
      </h2>
      {records.bestSet === null ? (
        <p className="detail-card__text">No completed sets yet — your records will appear here after you save a workout.</p>
      ) : (
        <>
          <dl className="pr-card__list">
            <Row label="Best set" set={records.bestSet} exercise={exercise} />
            {isWeightedReps && records.bestEstimatedOneRepMax && e1rm !== null && (
              <div className="pr-card__row">
                <dt>Est. 1RM*</dt>
                <dd>
                  <strong data-testid="pr-e1rm">
                    {formatNumber(fromKg(e1rm, displayUnit))} {unitLabel(displayUnit)}
                  </strong>
                  <span className="pr-card__extra">from {formatSet(records.bestEstimatedOneRepMax, exercise)}</span>
                </dd>
              </div>
            )}
            {records.heaviestSet && exercise.loadType === 'WEIGHTED' && (
              <Row label="Heaviest" set={records.heaviestSet} exercise={exercise} />
            )}
            {records.mostReps && exercise.loadType !== 'WEIGHTED' && <Row label={amountWord} set={records.mostReps} exercise={exercise} />}
            <div className="pr-card__row">
              <dt>Sessions</dt>
              <dd>
                <strong>{records.completedSessions}</strong>
              </dd>
            </div>
          </dl>
          {isWeightedReps && (
            <p className="pr-card__footnote">
              *Estimated one-rep max (Epley: weight × (1 + reps ÷ 30)). It is a calculation, not a tested maximum — there is no need to test it.
            </p>
          )}
          {exercise.loadType === 'ASSISTED' && <p className="pr-card__footnote">Less assistance means a harder set, so the best set uses the lowest assistance.</p>}
        </>
      )}
    </section>
  );
}
