import { useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { DayCard } from '../components/DayCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Toast } from '../components/Toast';
import { CompactAttendance } from '../components/consistency/CompactAttendance';
import { SplitEditor } from '../components/workout/SplitEditor';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useToast } from '../hooks/useToast';
import { useWorkoutPlan } from '../hooks/useWorkoutPlan';
import { errorMessage } from '../services/cloud/cloudErrors';
import { getGenderLabel } from '../constants/profileOptions';
import { getTodayDayId } from '../constants/workoutSchedule';
import type { Profile, WorkoutDay, WorkoutPlanType } from '../types/gym';

interface ProfileDashboardProps {
  profile: Profile;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
  onOpenConsistency: () => void;
}

export function ProfileDashboard({ profile, onBack, onSelectDay, onOpenConsistency }: ProfileDashboardProps) {
  const todayId = getTodayDayId();
  const { toast, showToast } = useToast();
  const { attendance, context, choose } = useAttendanceTracker(profile, showToast);
  const { planType, splitName, customDays, activeDays, saveCustom, setPlanType } = useWorkoutPlan(profile.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const trainingDays = activeDays.filter((day) => day.category !== 'rest').length;

  const changeType = async (next: WorkoutPlanType) => {
    if (next === planType || switching) return;
    setSwitching(true);
    try {
      await setPlanType(next);
      showToast(next === 'PPL' ? 'Switched to the PPL split' : 'Switched to your custom split');
    } catch (error) {
      showToast(errorMessage(error, 'Could not switch the workout split.'), 'error');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="page page--wide">
      <nav className="top-bar dashboard-toolbar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onBack} />
        <div className="dashboard-toolbar__side">
          <button type="button" className="button button--tracker" onClick={onOpenConsistency}>
            <CalendarCheck2 size={18} aria-hidden="true" />
            Consistency Tracker
          </button>
          <CompactAttendance attendance={attendance} context={context} onChoose={(date, status) => void choose(date, status)} />
        </div>
      </nav>

      <header className="dashboard-header">
        <div className="profile-identity">
          <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={56} />
          <div className="profile-identity__text">
            <span className="profile-identity__name">{profile.name}</span>
            <span className="profile-identity__meta">{getGenderLabel(profile.gender)}</span>
          </div>
        </div>
        <div className="plan-heading">
          <h1 className="page-title">Weekly Workout Plan</h1>
          <div className="plan-heading__controls">
            <label className="plan-select">
              <span className="visually-hidden">Workout split</span>
              <select
                value={planType}
                disabled={switching}
                aria-label="Workout split"
                onChange={(event) => void changeType(event.target.value as WorkoutPlanType)}
              >
                <option value="PPL">PPL</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>
            <button type="button" className="button button--ghost button--compact" onClick={() => setEditorOpen(true)}>
              Edit Split
            </button>
          </div>
        </div>
        <p className="page-subtitle">{planType === 'CUSTOM' ? splitName : 'Stay consistent, one workout at a time.'}</p>
        <p className="dashboard-header__stats">
          <strong>{trainingDays}</strong> training {trainingDays === 1 ? 'day' : 'days'} · <strong>{7 - trainingDays}</strong> rest{' '}
          {7 - trainingDays === 1 ? 'day' : 'days'}
        </p>
      </header>

      <ul className="week-grid" aria-label="Days of the week">
        {activeDays.map((day) => (
          <li key={day.id}>
            <DayCard day={day} isToday={day.id === todayId} onSelect={onSelectDay} />
          </li>
        ))}
      </ul>
      <SplitEditor
        isOpen={editorOpen}
        splitName={splitName}
        days={customDays}
        onClose={() => setEditorOpen(false)}
        onSave={async (name, days) => {
          await saveCustom(name, days, planType === 'PPL' ? 'PPL' : 'CUSTOM');
          showToast('Custom split saved');
        }}
      />
      <Toast toast={toast} />
    </div>
  );
}
