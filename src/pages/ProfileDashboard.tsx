import { useState } from 'react';
import { BackButton } from '../components/BackButton';
import { DayCard } from '../components/DayCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Toast } from '../components/Toast';
import { CompactAttendance } from '../components/consistency/CompactAttendance';
import { SplitEditor } from '../components/workout/SplitEditor';
import { WorkoutSplitSelector } from '../components/workout/WorkoutSplitSelector';
import { getGenderLabel } from '../constants/profileOptions';
import { getTodayDayId } from '../constants/workoutSchedule';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useToast } from '../hooks/useToast';
import { useWorkoutPlan } from '../hooks/useWorkoutPlan';
import type { CustomDayPlan, Profile, WorkoutDay, WorkoutSplitTemplate } from '../types/gym';
import { defaultCustomSchedule, isSplitNameTaken } from '../utils/workoutPlan';

interface ProfileDashboardProps {
  profile: Profile;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
}

/** What the split editor is doing: creating a new split, or editing a saved one. */
type SplitEditorState =
  | { isOpen: false }
  | { isOpen: true; mode: 'create'; splitName: string; days: CustomDayPlan[] }
  | { isOpen: true; mode: 'edit'; template: WorkoutSplitTemplate };

export function ProfileDashboard({ profile, onBack, onSelectDay }: ProfileDashboardProps) {
  const todayId = getTodayDayId();
  const { toast, showToast } = useToast();
  const { attendance, context, choose } = useAttendanceTracker(profile, showToast);
  const {
    splitTemplates,
    activeWorkoutSplit,
    activeDays,
    activateBuiltInPpl,
    activateWorkoutSplit,
    createWorkoutSplit,
    updateWorkoutSplit,
    duplicateWorkoutSplit,
    deleteWorkoutSplit,
  } = useWorkoutPlan(profile.id);
  const [splitEditor, setSplitEditor] = useState<SplitEditorState>({ isOpen: false });
  const trainingDays = activeDays.filter((day) => day.category !== 'rest').length;

  const editingTemplateId = splitEditor.isOpen && splitEditor.mode === 'edit' ? splitEditor.template.id : undefined;

  const saveSplit = async (splitName: string, days: CustomDayPlan[]) => {
    if (!splitEditor.isOpen) return;
    if (splitEditor.mode === 'edit') {
      await updateWorkoutSplit(splitEditor.template, splitName, days);
      showToast(`Saved “${splitName}”`);
      return;
    }
    // A new split becomes the weekly plan right away; it can be switched back any time.
    const created = await createWorkoutSplit(splitName, days);
    await activateWorkoutSplit(created);
    showToast(`Created “${created.splitName}” and made it active`);
  };

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onBack} />
      </nav>

      <header className="dashboard-header">
        {/* Identity on the left, today's attendance ("Eeroju Gym ki ellava?") on the right of the same row. */}
        <div className="dashboard-identity-row" data-testid="dashboard-identity-row">
          <div className="profile-identity">
            <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={48} />
            <div className="profile-identity__text">
              <span className="profile-identity__name">{profile.name}</span>
              <span className="profile-identity__meta">{getGenderLabel(profile.gender)}</span>
            </div>
          </div>
          <CompactAttendance attendance={attendance} context={context} onChoose={(date, status) => void choose(date, status)} />
        </div>
        <div className="plan-heading">
          <h1 className="page-title">Weekly Workout Plan</h1>
          <WorkoutSplitSelector
            activeWorkoutSplit={activeWorkoutSplit}
            splitTemplates={splitTemplates}
            onActivateBuiltInPpl={async () => {
              await activateBuiltInPpl();
              showToast('Switched to Push Pull Legs');
            }}
            onActivateWorkoutSplit={async (template) => {
              await activateWorkoutSplit(template);
              showToast(`Switched to “${template.splitName}”`);
            }}
            onCreateWorkoutSplit={() => setSplitEditor({ isOpen: true, mode: 'create', splitName: '', days: defaultCustomSchedule() })}
            onEditWorkoutSplit={(template) => setSplitEditor({ isOpen: true, mode: 'edit', template })}
            onSaveLegacySplit={(splitName, days) => setSplitEditor({ isOpen: true, mode: 'create', splitName, days })}
            onDuplicateWorkoutSplit={async (sourceName, sourceDays) => {
              const copy = await duplicateWorkoutSplit(sourceName, sourceDays);
              showToast(`Duplicated as “${copy.splitName}”`);
            }}
            onDeleteWorkoutSplit={async (template) => {
              await deleteWorkoutSplit(template);
              showToast(`Deleted “${template.splitName}”`, 'info');
            }}
          />
        </div>
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
        isOpen={splitEditor.isOpen}
        mode={splitEditor.isOpen ? splitEditor.mode : 'create'}
        splitName={splitEditor.isOpen ? (splitEditor.mode === 'edit' ? splitEditor.template.splitName : splitEditor.splitName) : ''}
        days={splitEditor.isOpen ? (splitEditor.mode === 'edit' ? splitEditor.template.days : splitEditor.days) : EMPTY_DAYS}
        isNameTaken={(splitName) => isSplitNameTaken(splitName, splitTemplates, editingTemplateId)}
        onClose={() => setSplitEditor({ isOpen: false })}
        onSave={saveSplit}
      />
      <Toast toast={toast} />
    </div>
  );
}

const EMPTY_DAYS: CustomDayPlan[] = [];
