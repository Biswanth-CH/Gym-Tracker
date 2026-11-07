import { CalendarRange, ChevronLeft, ChevronRight, Dumbbell, Flame, Gauge } from 'lucide-react';
import { formatPercentage, type MonthInfo, type PeriodStats } from '../../utils/consistencyUtils';

interface ConsistencySummaryProps {
  month: MonthInfo;
  stats: PeriodStats;
  streak: number;
  isCurrentMonth: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function ConsistencySummary({
  month,
  stats,
  streak,
  isCurrentMonth,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: ConsistencySummaryProps) {
  const percentage = stats.percentage === null ? 0 : Math.min(100, stats.percentage);

  return (
    <section className="summary" aria-labelledby="summary-heading">
      <div className="month-switcher">
        <button
          type="button"
          className="icon-button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 id="summary-heading" className="month-switcher__label" aria-live="polite">
          {month.label} {month.year}
          {isCurrentMonth && <span className="month-switcher__tag">This month</span>}
        </h2>
        <button type="button" className="icon-button" onClick={onNext} disabled={!canGoNext} aria-label="Next month">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <dl className="stat-grid">
        <div className="stat-card stat-card--visits">
          <dt>
            <Dumbbell size={16} aria-hidden="true" /> Gym Visits
          </dt>
          <dd data-testid="stat-visits">{stats.visits}</dd>
          <dd className="stat-card__hint">{stats.missed} missed · {stats.unmarked} unmarked</dd>
        </div>
        <div className="stat-card stat-card--valid">
          <dt>
            <CalendarRange size={16} aria-hidden="true" /> Valid Gym Days
          </dt>
          <dd data-testid="stat-valid">{stats.validDays}</dd>
          <dd className="stat-card__hint">{isCurrentMonth ? 'Mon–Sat, so far' : 'Mon–Sat, excl. Sundays'}</dd>
        </div>
        <div className="stat-card stat-card--consistency">
          <dt>
            <Gauge size={16} aria-hidden="true" /> Consistency
          </dt>
          <dd data-testid="stat-consistency">{formatPercentage(stats.percentage)}</dd>
          <dd className="stat-card__progress" aria-hidden="true"><span className="progress">
            <span className="progress__bar" style={{ width: `${percentage}%` }} />
          </span></dd>
        </div>
        <div className="stat-card stat-card--streak">
          <dt>
            <Flame size={16} aria-hidden="true" /> Current Streak
          </dt>
          <dd data-testid="stat-streak">
            {streak} <span className="stat-card__unit">{streak === 1 ? 'day' : 'days'}</span>
          </dd>
          <dd className="stat-card__hint">Sundays don’t break it</dd>
        </div>
      </dl>
    </section>
  );
}
