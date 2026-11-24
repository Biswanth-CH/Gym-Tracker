import { BackButton } from '../components/BackButton';
import { Toast } from '../components/Toast';
import { CompactAttendance } from '../components/consistency/CompactAttendance';
import { TodayWeight } from '../components/consistency/TodayWeight';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useToast } from '../hooks/useToast';
import type { Profile } from '../types/gym';
import { formatShortDate } from '../utils/dateUtils';

interface TodayLogPageProps {
  profile: Profile;
  onBack: () => void;
}

/**
 * Today's data (Phase 8): attendance ("Eeroju vellava?" with Went / Did Not Go / Clear Mark)
 * and today's weight ("Eeroju weight?"). Opened from the weekly plan's status button.
 * Uses the existing attendance and body-weight services; nothing is stored twice.
 */
export function TodayLogPage({ profile, onBack }: TodayLogPageProps) {
  const { toast, showToast } = useToast();
  const { attendance, context, choose } = useAttendanceTracker(profile, showToast);

  return (
    <div className="page today-page" data-testid="today-page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Weekly plan" onClick={onBack} />
      </nav>
      <header className="dashboard-header">
        <p className="eyebrow">{profile.name}</p>
        <h1 className="page-title">Today’s data</h1>
        <p className="today-page__date">{formatShortDate(context.todayKey)}</p>
      </header>
      <section className="detail-card today-page__card" aria-label="Today's attendance">
        <CompactAttendance attendance={attendance} context={context} onChoose={(date, status) => void choose(date, status)} allowClear />
      </section>
      <section className="detail-card today-page__card" aria-label="Today's weight">
        <TodayWeight profileId={profile.id} todayKey={context.todayKey} onToast={showToast} />
      </section>
      <Toast toast={toast} />
    </div>
  );
}
