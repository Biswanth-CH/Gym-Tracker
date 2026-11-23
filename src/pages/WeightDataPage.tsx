import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Scale } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { Toast } from '../components/Toast';
import { WeightLogModal } from '../components/consistency/BodyWeightSection';
import { useBodyWeight } from '../hooks/useBodyWeight';
import { useCloudSlice } from '../hooks/useCloud';
import { useToast } from '../hooks/useToast';
import { useToday } from '../hooks/useToday';
import { useWeightUnitPreference } from '../hooks/useWeightUnitPreference';
import type { DateKey, Profile } from '../types/gym';
import { formatLongDate, formatMonthYear, parseDateKey } from '../utils/dateUtils';
import { buildMonthWeeks, formatWeightCell, shiftMonth } from '../utils/weightCalendar';
import { unitLabel } from '../utils/workoutUtils';

interface WeightDataPageProps {
  profile: Profile;
  backLabel: string;
  onBack: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Previous body-weight records as a month calendar. Each recorded date shows its value
 * in the profile theme colour; tapping a date edits, adds or deletes that day's single
 * entry through the existing body-weight service (one entry per profile per date).
 */
export function WeightDataPage({ profile, backLabel, onBack }: WeightDataPageProps) {
  const todayKey = useToday();
  const phase = useCloudSlice((snapshot) => snapshot.phase);
  const { entries, byDate, save, remove } = useBodyWeight(profile.id);
  const [unit, setUnit] = useWeightUnitPreference();
  const { toast, showToast } = useToast();
  const today = parseDateKey(todayKey);
  const [visibleMonth, setVisibleMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<DateKey | null>(null);

  // Navigation goes back to the earlier of the first entry and the tracking start, and never past this month.
  const earliestKey = [entries[0]?.date, profile.trackingStartDate].filter((key): key is string => Boolean(key)).sort()[0] ?? todayKey;
  const earliest = parseDateKey(earliestKey < todayKey ? earliestKey : todayKey);
  const monthIndex = (year: number, month: number) => year * 12 + month;
  const canGoPrevious = monthIndex(visibleMonth.year, visibleMonth.month) > monthIndex(earliest.getFullYear(), earliest.getMonth());
  const canGoNext = monthIndex(visibleMonth.year, visibleMonth.month) < monthIndex(today.getFullYear(), today.getMonth());
  const weeks = useMemo(() => buildMonthWeeks(visibleMonth.year, visibleMonth.month), [visibleMonth]);
  const monthEntryCount = weeks.flat().filter((dateKey) => dateKey && byDate.has(dateKey)).length;

  return (
    <div className="page page--wide weight-data" data-testid="weight-data-page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={backLabel} onClick={onBack} />
      </nav>
      <header className="dashboard-header">
        <h1 className="page-title">Weight Data</h1>
        <p className="page-subtitle">Tap a day to add, edit or delete its weight.</p>
      </header>

      <section className="detail-card weight-calendar" aria-labelledby="weight-month-heading">
        <div className="weight-calendar__toolbar">
          <div className="month-switcher">
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisibleMonth((current) => shiftMonth(current.year, current.month, -1))}
              disabled={!canGoPrevious}
              aria-label="Previous month"
              data-testid="weight-month-previous"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h2 id="weight-month-heading" className="month-switcher__label" aria-live="polite" data-testid="weight-month-label">
              {formatMonthYear(visibleMonth.year, visibleMonth.month)}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisibleMonth((current) => shiftMonth(current.year, current.month, 1))}
              disabled={!canGoNext}
              aria-label="Next month"
              data-testid="weight-month-next"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Weight unit">
            {(['KG', 'LB'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented__option${unit === option ? ' is-active' : ''}`}
                aria-pressed={unit === option}
                onClick={() => setUnit(option)}
                data-testid={`weight-unit-${option.toLowerCase()}`}
              >
                {unitLabel(option)}
              </button>
            ))}
          </div>
        </div>

        {phase === 'loading' ? (
          <p className="loading-label" role="status">
            <Loader2 size={16} className="spin" aria-hidden="true" /> Loading weights…
          </p>
        ) : (
          <>
            <div className="weight-calendar__grid" role="grid" aria-label={`Body weight in ${formatMonthYear(visibleMonth.year, visibleMonth.month)} (${unitLabel(unit)})`}>
              <div className="weight-calendar__row weight-calendar__row--head" role="row">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday} className="weight-calendar__weekday" role="columnheader">
                    {weekday}
                  </span>
                ))}
              </div>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="weight-calendar__row" role="row">
                  {week.map((dateKey, dayIndex) => {
                    if (!dateKey) return <span key={`pad-${dayIndex}`} className="weight-calendar__cell weight-calendar__cell--pad" role="gridcell" aria-hidden="true" />;
                    const entry = byDate.get(dateKey);
                    const isFuture = dateKey > todayKey;
                    const dayNumber = parseDateKey(dateKey).getDate();
                    const valueText = entry ? formatWeightCell(entry.weightKg, unit) : null;
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        role="gridcell"
                        className={`weight-calendar__cell${entry ? ' has-weight' : ''}${dateKey === todayKey ? ' is-today' : ''}`}
                        disabled={isFuture}
                        onClick={() => setSelectedDate(dateKey)}
                        aria-label={`${formatLongDate(dateKey)}: ${valueText ? `${valueText} ${unitLabel(unit)}` : 'no weight'}`}
                        data-testid={`weight-cell-${dateKey}`}
                      >
                        <span className="weight-calendar__day">{dayNumber}</span>
                        {valueText && <span className="weight-calendar__value">{valueText}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="weight-calendar__caption" data-testid="weight-month-count">
              {monthEntryCount === 0 ? 'No weights logged this month.' : `${monthEntryCount} ${monthEntryCount === 1 ? 'day' : 'days'} logged · values in ${unitLabel(unit)}`}
            </p>
          </>
        )}
      </section>

      {phase !== 'loading' && entries.length === 0 && (
        <EmptyState icon={<Scale size={28} aria-hidden="true" />} title="No body weight yet" message="Tap today in the calendar, or use Log Today’s Weight on the profile, to start your history." />
      )}

      <WeightLogModal
        isOpen={selectedDate !== null}
        todayKey={todayKey}
        initialDate={selectedDate ?? undefined}
        unit={unit}
        onUnit={setUnit}
        existing={byDate}
        onClose={() => setSelectedDate(null)}
        onSave={async (date, weight, nextUnit) => {
          await save(date, weight, nextUnit);
          showToast('Body weight saved');
          setSelectedDate(null);
        }}
        onDelete={async (date) => {
          const entry = byDate.get(date);
          if (!entry) return;
          await remove(entry.id);
          showToast('Body weight deleted', 'info');
          setSelectedDate(null);
        }}
        onToast={showToast}
      />
      <Toast toast={toast} />
    </div>
  );
}
