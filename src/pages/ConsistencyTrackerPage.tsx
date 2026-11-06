import { useCallback, useMemo, useState } from 'react';
import { Check, Moon, X as XIcon } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Toast } from '../components/Toast';
import { AttendanceCalendar } from '../components/consistency/AttendanceCalendar';
import { AttendanceModal } from '../components/consistency/AttendanceModal';
import { ConsistencySummary } from '../components/consistency/ConsistencySummary';
import { MonthlyStatistics } from '../components/consistency/MonthlyStatistics';
import { useAttendance } from '../hooks/useAttendance';
import { useToast } from '../hooks/useToast';
import { useToday } from '../hooks/useToday';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import {
  calculateCurrentStreak,
  calculateMonthStats,
  calculateRangeStats,
  getDayState,
  getTrackedMonths,
  isMarkableState,
  type TrackerContext,
} from '../utils/consistencyUtils';
import { formatShortDate, isoToLocalDateKey } from '../utils/dateUtils';

interface ConsistencyTrackerPageProps {
  profile: Profile;
  onBack: () => void;
}

const TRACKED_MONTH_COUNT = 12;

export function ConsistencyTrackerPage({ profile, onBack }: ConsistencyTrackerPageProps) {
  const todayKey = useToday();
  const { attendance, loadError, mark, clear } = useAttendance(profile.id);
  const { toast, showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<DateKey | null>(null);

  const context: TrackerContext = useMemo(
    () => ({ todayKey, trackingStartKey: isoToLocalDateKey(profile.createdAt) ?? todayKey }),
    [todayKey, profile.createdAt],
  );

  const months = useMemo(() => getTrackedMonths(todayKey, TRACKED_MONTH_COUNT), [todayKey]);
  const currentMonthKey = months[months.length - 1].key;
  const [selectedMonthKeyState, setSelectedMonthKey] = useState(currentMonthKey);
  // If the app stays open into a new month, fall back to a month that still exists.
  const selectedMonth = months.find((month) => month.key === selectedMonthKeyState) ?? months[months.length - 1];
  const visibleIndex = months.indexOf(selectedMonth);

  const monthlyRows = useMemo(
    () => months.map((month) => ({ month, stats: calculateMonthStats(month, attendance, context) })),
    [months, attendance, context],
  );
  const selectedStats =
    monthlyRows.find((row) => row.month.key === selectedMonth.key)?.stats ??
    calculateMonthStats(selectedMonth, attendance, context);
  const yearStats = useMemo(
    () => calculateRangeStats(months[0].firstDayKey, months[months.length - 1].lastDayKey, attendance, context),
    [months, attendance, context],
  );
  const streak = useMemo(() => calculateCurrentStreak(attendance, context), [attendance, context]);

  const handleChoose = useCallback(
    (date: DateKey, status: AttendanceStatus | null) => {
      try {
        if (status === null) {
          clear(date);
          showToast(`Cleared ${formatShortDate(date)}`, 'info');
        } else {
          mark(date, status);
          showToast(
            `${formatShortDate(date)}: ${status === 'ATTENDED' ? 'went to gym' : 'did not go'}`,
            status === 'ATTENDED' ? 'success' : 'info',
          );
        }
        setSelectedDate(null);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save attendance.', 'error');
      }
    },
    [clear, mark, showToast],
  );

  const todayState = getDayState(todayKey, attendance, context);
  const todayStatus = attendance.get(todayKey);

  return (
    <div className="page page--wide page--tracker">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
        <span className="top-bar__identity">
          <ProfileAvatar seed={profile.id} name={profile.name} photoDataUrl={profile.photoDataUrl} size={28} />
          <span className="top-bar__context">{profile.name}</span>
        </span>
      </nav>

      <header className="dashboard-header">
        <h1 className="page-title">Consistency Tracker</h1>
        <p className="page-subtitle">Tap a day to log whether you made it to the gym.</p>
      </header>

      {loadError && (
        <p className="inline-alert" role="alert">
          {loadError}
        </p>
      )}

      <ConsistencySummary
        month={selectedMonth}
        stats={selectedStats}
        streak={streak}
        isCurrentMonth={selectedMonth.key === currentMonthKey}
        canGoPrevious={visibleIndex > 0}
        canGoNext={visibleIndex < months.length - 1}
        onPrevious={() => setSelectedMonthKey(months[Math.max(0, visibleIndex - 1)].key)}
        onNext={() => setSelectedMonthKey(months[Math.min(months.length - 1, visibleIndex + 1)].key)}
      />

      <section className="detail-card heatmap-card" aria-labelledby="calendar-heading">
        <div className="heatmap-card__header">
          <h2 id="calendar-heading" className="heatmap-card__title">
            Attendance · last 12 months
          </h2>
          <span className="heatmap-card__count">{yearStats.visits} visits</span>
        </div>
        <AttendanceCalendar
          months={months}
          attendance={attendance}
          context={context}
          selectedMonthKey={selectedMonth.key}
          onSelectMonth={setSelectedMonthKey}
          onSelectDate={setSelectedDate}
        />
      </section>

      <section className="today-log" aria-label="Log today">
        {isMarkableState(todayState) ? (
          <>
            <div className="today-log__text">
              <span className="today-log__label">Today</span>
              <span className="today-log__date">{formatShortDate(todayKey)}</span>
            </div>
            <div className="today-log__actions">
              <button
                type="button"
                className={`chip-button chip-button--attended${todayStatus === 'ATTENDED' ? ' is-active' : ''}`}
                onClick={() => handleChoose(todayKey, 'ATTENDED')}
                aria-pressed={todayStatus === 'ATTENDED'}
              >
                <Check size={16} aria-hidden="true" />
                Went to Gym
              </button>
              <button
                type="button"
                className={`chip-button chip-button--missed${todayStatus === 'MISSED' ? ' is-active' : ''}`}
                onClick={() => handleChoose(todayKey, 'MISSED')}
                aria-pressed={todayStatus === 'MISSED'}
              >
                <XIcon size={16} aria-hidden="true" />
                Did Not Go
              </button>
            </div>
          </>
        ) : (
          <div className="today-log__text today-log__text--rest">
            <Moon size={18} aria-hidden="true" />
            <span>Sunday is a rest day — nothing to log today.</span>
          </div>
        )}
      </section>

      <MonthlyStatistics
        rows={[...monthlyRows].reverse()}
        yearStats={yearStats}
        selectedMonthKey={selectedMonth.key}
        onSelectMonth={(key) => {
          setSelectedMonthKey(key);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <AttendanceModal
        dateKey={selectedDate}
        status={selectedDate ? attendance.get(selectedDate) : undefined}
        isToday={selectedDate === todayKey}
        onClose={() => setSelectedDate(null)}
        onChoose={(status) => selectedDate && handleChoose(selectedDate, status)}
      />
      <Toast toast={toast} />
    </div>
  );
}
