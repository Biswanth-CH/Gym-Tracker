import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { Toast } from '../components/Toast';
import { AttendanceCalendar } from '../components/consistency/AttendanceCalendar';
import { AttendanceModal } from '../components/consistency/AttendanceModal';
import { AttendanceQuickLog } from '../components/consistency/AttendanceQuickLog';
import { ConsistencySummary } from '../components/consistency/ConsistencySummary';
import { BodyWeightSection } from '../components/consistency/BodyWeightSection';
import { AttendanceColourInfo } from '../components/consistency/AttendanceColourInfo';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useExerciseSelections } from '../hooks/useCloud';
import { EXERCISES_BY_ID } from '../constants/exerciseLibrary';
import { MUSCLE_GROUPS_BY_ID, getMuscleRegion } from '../constants/muscleGroups';
import type { DayExerciseItem } from '../components/consistency/AttendanceModal';
import { useToast } from '../hooks/useToast';
import type { AttendanceStatus, DateKey, Profile } from '../types/gym';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateMonthStats,
  getDayState,
  getTrackedMonths,
  isMarkableState,
} from '../utils/consistencyUtils';
import { formatLongDate } from '../utils/dateUtils';

interface ConsistencyTrackerPageProps {
  profile: Profile;
  onBack: () => void;
  onOpenWeightData: () => void;
  onOpenMonthlyStatistics: () => void;
}

const TRACKED_MONTH_COUNT = 12;

export function ConsistencyTrackerPage({ profile, onBack, onOpenWeightData, onOpenMonthlyStatistics }: ConsistencyTrackerPageProps) {
  const { toast, showToast } = useToast();
  const { todayKey, attendance, loadError, context, choose } = useAttendanceTracker(profile, showToast);
  const [selectedDate, setSelectedDate] = useState<DateKey | null>(null);

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
  const streak = useMemo(() => calculateCurrentStreak(attendance, context), [attendance, context]);
  const highestStreak = useMemo(() => calculateLongestStreak(attendance, context), [attendance, context]);

  const handleChoose = async (date: DateKey, status: AttendanceStatus | null) => {
    if (await choose(date, status)) setSelectedDate(null);
  };

  // Exercise variations per date, from daily_exercise_selections (kept for every past date).
  const { byDate } = useExerciseSelections(profile.id);
  const workoutCounts = useMemo(() => new Map([...byDate].map(([date, ids]) => [date, ids.length])), [byDate]);
  const selectedExercises: DayExerciseItem[] = useMemo(() => {
    if (!selectedDate) return [];
    return (byDate.get(selectedDate) ?? []).flatMap((exerciseId) => {
      const exercise = EXERCISES_BY_ID.get(exerciseId);
      if (!exercise) return [{ id: exerciseId, name: exerciseId, detail: 'Exercise no longer in the library' }];
      const target = exercise.targets[0];
      const region = getMuscleRegion(target.regionId);
      return [{ id: exerciseId, name: exercise.name, detail: `${region?.name ?? ''} · ${MUSCLE_GROUPS_BY_ID[target.muscleGroupId].name}` }];
    });
  }, [byDate, selectedDate]);
  const selectedState = selectedDate ? getDayState(selectedDate, attendance, context) : null;
  const markNote =
    selectedState === 'sunday'
      ? 'Sundays are rest days, so attendance isn’t tracked.'
      : selectedState === 'before-start'
        ? `Attendance tracking starts on ${formatLongDate(context.trackingStartKey)}. You can change this date in the profile settings.`
        : undefined;

  return (
    <div className="page page--wide page--tracker">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profile overview" onClick={onBack} />
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
        highestStreak={highestStreak}
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
          <AttendanceColourInfo />
        </div>
        <AttendanceCalendar
          months={months}
          attendance={attendance}
          context={context}
          selectedMonthKey={selectedMonth.key}
          onSelectMonth={setSelectedMonthKey}
          onSelectDate={setSelectedDate}
          workoutCounts={workoutCounts}
        />
      </section>

      <section className="detail-card consistency-track" aria-labelledby="consistency-track-heading" data-testid="consistency-track">
        <h2 id="consistency-track-heading" className="detail-card__title">
          Consistency Track
        </h2>
        <AttendanceQuickLog attendance={attendance} context={context} onChoose={(date, status) => void choose(date, status)} title="Today" />
        <button type="button" className="button button--ghost consistency-track__stats" onClick={onOpenMonthlyStatistics} data-testid="open-monthly-statistics">
          <BarChart3 size={18} aria-hidden="true" /> Monthly Statistics
        </button>
      </section>

      <BodyWeightSection profile={profile} todayKey={todayKey} onToast={showToast} onOpenWeightData={onOpenWeightData} />


      <AttendanceModal
        dateKey={selectedDate}
        status={selectedDate ? attendance.get(selectedDate) : undefined}
        isToday={selectedDate === todayKey}
        canMark={selectedState ? isMarkableState(selectedState) : false}
        markNote={markNote}
        exercises={selectedExercises}
        onClose={() => setSelectedDate(null)}
        onChoose={(status) => selectedDate && void handleChoose(selectedDate, status)}
      />
      <Toast toast={toast} />
    </div>
  );
}
