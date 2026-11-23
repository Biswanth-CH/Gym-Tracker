import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { Toast } from '../components/Toast';
import { MonthlyStatistics } from '../components/consistency/MonthlyStatistics';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useCloudSlice } from '../hooks/useCloud';
import { useToast } from '../hooks/useToast';
import type { Profile } from '../types/gym';
import { calculateMonthStats, calculateRangeStats, getTrackedMonths } from '../utils/consistencyUtils';

interface MonthlyStatisticsPageProps {
  profile: Profile;
  backLabel: string;
  onBack: () => void;
}

const TRACKED_MONTH_COUNT = 12;

/**
 * The existing Monthly Statistics (last 12 months), now on its own page instead of a
 * modal. Same component and the same calculateMonthStats / calculateRangeStats maths.
 */
export function MonthlyStatisticsPage({ profile, backLabel, onBack }: MonthlyStatisticsPageProps) {
  const { toast, showToast } = useToast();
  const phase = useCloudSlice((snapshot) => snapshot.phase);
  const { todayKey, attendance, context } = useAttendanceTracker(profile, showToast);
  const months = useMemo(() => getTrackedMonths(todayKey, TRACKED_MONTH_COUNT), [todayKey]);
  const [selectedMonthKey, setSelectedMonthKey] = useState(months[months.length - 1].key);
  const monthlyRows = useMemo(
    () => months.map((month) => ({ month, stats: calculateMonthStats(month, attendance, context) })),
    [months, attendance, context],
  );
  const yearStats = useMemo(
    () => calculateRangeStats(months[0].firstDayKey, months[months.length - 1].lastDayKey, attendance, context),
    [months, attendance, context],
  );

  return (
    <div className="page page--wide" data-testid="monthly-statistics-page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={backLabel} onClick={onBack} />
      </nav>
      {phase === 'loading' ? (
        <p className="loading-label" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> Loading statistics…
        </p>
      ) : (
        <MonthlyStatistics rows={[...monthlyRows].reverse()} yearStats={yearStats} selectedMonthKey={selectedMonthKey} onSelectMonth={setSelectedMonthKey} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
