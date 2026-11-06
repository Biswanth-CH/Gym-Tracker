import { formatPercentage, type MonthInfo, type PeriodStats } from '../../utils/consistencyUtils';

interface MonthlyStatisticsProps {
  /** Newest first. */
  rows: Array<{ month: MonthInfo; stats: PeriodStats }>;
  yearStats: PeriodStats;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

export function MonthlyStatistics({ rows, yearStats, selectedMonthKey, onSelectMonth }: MonthlyStatisticsProps) {
  const currentYear = rows[0]?.month.year;

  return (
    <section className="section monthly" aria-labelledby="monthly-heading">
      <div className="section__header">
        <div>
          <h2 id="monthly-heading" className="section__title">
            Monthly statistics
          </h2>
          <p className="section__meta" data-testid="year-summary">
            Last 12 months: {yearStats.visits} visits / {yearStats.validDays} valid days ·{' '}
            <strong>{formatPercentage(yearStats.percentage)}</strong>
          </p>
        </div>
      </div>

      <ul className="month-grid">
        {rows.map(({ month, stats }) => {
          const isSelected = month.key === selectedMonthKey;
          const isTracked = stats.validDays > 0;
          return (
            <li key={month.key}>
              <button
                type="button"
                className={`month-card${isSelected ? ' is-selected' : ''}${isTracked ? '' : ' is-untracked'}`}
                onClick={() => onSelectMonth(month.key)}
                aria-pressed={isSelected}
                data-month={month.key}
              >
                <span className="month-card__name">
                  {month.label}
                  {month.year !== currentYear && <span className="month-card__year"> {month.year}</span>}
                </span>
                <span className="month-card__percent">{formatPercentage(stats.percentage)}</span>
                <span className="month-card__detail">
                  {isTracked ? `${stats.visits} visits / ${stats.validDays} valid days` : 'Not tracked'}
                </span>
                <span className="progress" aria-hidden="true">
                  <span className="progress__bar" style={{ width: `${Math.min(100, stats.percentage ?? 0)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
