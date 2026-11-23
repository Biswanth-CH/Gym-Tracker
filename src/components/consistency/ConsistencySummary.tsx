import { CalendarRange, ChevronLeft, ChevronRight, Dumbbell, Flame, Gauge, Trophy, XCircle } from 'lucide-react';
import { formatStreak } from '../../utils/streakDisplay';
import { formatPercentage, type MonthInfo, type PeriodStats } from '../../utils/consistencyUtils';

interface ConsistencySummaryProps {
  month: MonthInfo;
  stats: PeriodStats;
  streak: number;
  /** All-time highest streak (calculateLongestStreak). */
  highestStreak: number;
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
  highestStreak,
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

      {/* Row 1: the selected month's attendance (existing calculateRangeStats). */}
      <dl className="stat-grid stat-grid--three" data-testid="stat-row-attendance">
        <div className="stat-card stat-card--valid">
          <dt>
            <CalendarRange size={14} aria-hidden="true" /> Valid Gym Days
          </dt>
          <dd data-testid="stat-valid">{stats.validDays}</dd>
          <dd className="stat-card__hint">{isCurrentMonth ? 'Mon–Sat, so far' : 'Mon–Sat'}</dd>
        </div>
        <div className="stat-card stat-card--visits">
          <dt>
            <Dumbbell size={14} aria-hidden="true" /> Went
          </dt>
          <dd data-testid="stat-visits">{stats.visits}</dd>
          <dd className="stat-card__hint">{stats.unmarked} unmarked</dd>
        </div>
        <div className="stat-card stat-card--missed">
          <dt>
            <XCircle size={14} aria-hidden="true" /> Missed
          </dt>
          <dd data-testid="stat-missed">{stats.missed}</dd>
          <dd className="stat-card__hint">Did not go</dd>
        </div>
      </dl>
      {/* Row 2: streaks (all-time highest + current) and the month's consistency %. */}
      <dl className="stat-grid stat-grid--three" data-testid="stat-row-streaks">
        <div className="stat-card stat-card--highest">
          <dt>
            <Trophy size={14} aria-hidden="true" /> Highest Streak
          </dt>
          <dd data-testid="stat-highest-streak">{formatStreak(highestStreak)}</dd>
          <dd className="stat-card__hint">All time</dd>
        </div>
        <div className="stat-card stat-card--streak">
          <dt>
            <Flame size={14} aria-hidden="true" /> Current Streak
          </dt>
          <dd data-testid="stat-streak">{formatStreak(streak)}</dd>
          <dd className="stat-card__hint" title="Sundays don’t break a streak">Ongoing</dd>
        </div>
        <div className="stat-card stat-card--consistency">
          <dt>
            <Gauge size={14} aria-hidden="true" /> Consistency
          </dt>
          <dd data-testid="stat-consistency">{formatPercentage(stats.percentage)}</dd>
          <dd className="stat-card__progress" aria-hidden="true">
            <span className="progress">
              <span className="progress__bar" style={{ width: `${percentage}%` }} />
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
