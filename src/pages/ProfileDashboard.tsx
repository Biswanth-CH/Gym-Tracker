import { useState } from 'react';
import { BackButton } from '../components/BackButton';
import { DayCard } from '../components/DayCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { Toast } from '../components/Toast';
import { CalendarCheck } from 'lucide-react';
import { CreateSplitChooser } from '../components/workout/CreateSplitChooser';
import { SplitEditor } from '../components/workout/SplitEditor';
import { WorkoutSplitSelector } from '../components/workout/WorkoutSplitSelector';
import { getGenderLabel } from '../constants/profileOptions';
import { getTodayDayId } from '../constants/workoutSchedule';
import { useToday } from '../hooks/useToday';
import { useSplitBackgrounds } from '../hooks/useSplitBackgrounds';
import { parseDateKey } from '../utils/dateUtils';
import { useAttendanceTracker } from '../hooks/useAttendanceTracker';
import { useBodyWeight } from '../hooks/useBodyWeight';
import { getDayState, isMarkableState } from '../utils/consistencyUtils';
import { todayLogStatus } from '../utils/todayStatus';
import { useToast } from '../hooks/useToast';
import { useWorkoutPlan } from '../hooks/useWorkoutPlan';
import { errorMessage } from '../services/cloud/cloudErrors';
import { splitBackgroundService } from '../services/cloud/splitBackgroundService';
import type { CustomDayPlan, Profile, WorkoutDay, WorkoutSplitTemplate } from '../types/gym';
import { draftsFromStored, type SplitBackgroundDrafts } from '../utils/splitBackgrounds';
import { cloneSchedule, defaultCustomSchedule, duplicateSplitName, isSplitNameTaken } from '../utils/workoutPlan';

interface ProfileDashboardProps {
  profile: Profile;
  onBack: () => void;
  onSelectDay: (day: WorkoutDay) => void;
  /** Opens the Today page (attendance + weight). */
  onOpenToday: () => void;
}

/**
 * What the split editor is doing: creating a new split (from scratch or as a duplicate of a
 * saved split, with that split's backgrounds as reused references), or editing a saved one.
 * Backgrounds are captured when the editor opens, so a background refresh never resets drafts.
 */
type SplitEditorState =
  | { isOpen: false }
  | { isOpen: true; mode: 'create'; splitName: string; days: CustomDayPlan[]; backgrounds: SplitBackgroundDrafts }
  | { isOpen: true; mode: 'edit'; template: WorkoutSplitTemplate; backgrounds: SplitBackgroundDrafts };

const NO_BACKGROUNDS: SplitBackgroundDrafts = {};

export function ProfileDashboard({ profile, onBack, onSelectDay, onOpenToday }: ProfileDashboardProps) {
  // Local calendar date; useToday re-checks every minute, so the highlight moves at midnight.
  const todayKey = useToday();
  const todayId = getTodayDayId(parseDateKey(todayKey));
  const { backgroundsOfSplit, getSplitDayBackground } = useSplitBackgrounds();
  const { toast, showToast } = useToast();
  const { attendance, context } = useAttendanceTracker(profile, showToast);
  const { byDate: weightsByDate } = useBodyWeight(profile.id);
  const todayStatus = todayLogStatus({
    attendanceMarkable: isMarkableState(getDayState(todayKey, attendance, context)),
    attendance: attendance.get(todayKey),
    hasWeight: weightsByDate.has(todayKey),
  });
  const {
    accountWorkoutSplits,
    profileCountBySplitId,
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
  const [choosingCreate, setChoosingCreate] = useState(false);

  // Phase 8: day backgrounds belong to the ACTIVE shared split (same for every profile using it).
  const activeSplitId = activeWorkoutSplit.kind === 'CUSTOM' ? activeWorkoutSplit.template.id : null;
  const dayBackground = (dayId: WorkoutDay['id']) => {
    const background = getSplitDayBackground(activeSplitId, dayId);
    return background ? { imageUrl: background.imageUrl, settings: background } : null;
  };

  const editingTemplateId = splitEditor.isOpen && splitEditor.mode === 'edit' ? splitEditor.template.id : undefined;

  const saveBackgrounds = async (splitId: string, drafts: SplitBackgroundDrafts) => {
    await splitBackgroundService.saveDrafts(splitId, drafts);
  };

  const saveSplit = async (splitName: string, days: CustomDayPlan[], backgrounds: SplitBackgroundDrafts) => {
    if (!splitEditor.isOpen) return;
    if (splitEditor.mode === 'edit') {
      await updateWorkoutSplit(splitEditor.template, splitName, days);
      // A failure here keeps the editor open; saving again is safe (the split update is idempotent).
      await saveBackgrounds(splitEditor.template.id, backgrounds);
      showToast(`Saved “${splitName}”`);
      return;
    }
    // A new split becomes the weekly plan right away; it can be switched back any time.
    const created = await createWorkoutSplit(splitName, days);
    await activateWorkoutSplit(created);
    try {
      await saveBackgrounds(created.id, backgrounds);
      showToast(`Created “${created.splitName}” and made it active`);
    } catch (backgroundError) {
      // The split exists: never create it twice. Report and let the user edit the backgrounds.
      showToast(`Created “${created.splitName}”, but its backgrounds were not saved: ${errorMessage(backgroundError, 'please try again from Edit split.')}`, 'error');
    }
  };

  const startDuplicate = (template: WorkoutSplitTemplate) => {
    setChoosingCreate(false);
    setSplitEditor({
      isOpen: true,
      mode: 'create',
      splitName: duplicateSplitName(template.splitName, accountWorkoutSplits),
      days: cloneSchedule(template.days),
      // Same stored image references: nothing is uploaded again.
      backgrounds: draftsFromStored(backgroundsOfSplit(template.id)),
    });
  };

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label="Profiles" onClick={onBack} />
      </nav>

      <header className="dashboard-header">
        {/* Identity on the left; today's data status on the right (opens the Today page). */}
        <div className="dashboard-identity-row" data-testid="dashboard-identity-row">
          <div className="profile-identity">
            <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={48} />
            <div className="profile-identity__text">
              <span className="profile-identity__name">{profile.name}</span>
              <span className="profile-identity__meta">{getGenderLabel(profile.gender)}</span>
            </div>
          </div>
          <button
            type="button"
            className={`today-log-button today-log-button--${todayStatus.tone}`}
            onClick={onOpenToday}
            aria-label={`${todayStatus.label} (${todayStatus.done} of ${todayStatus.total} logged). Open today’s attendance and weight`}
            data-testid="today-log-button"
            data-tone={todayStatus.tone}
          >
            <CalendarCheck size={16} aria-hidden="true" /> {todayStatus.label}
          </button>
        </div>
        <div className="plan-heading">
          <h1 className="page-title">Weekly Workout Plan</h1>
          <WorkoutSplitSelector
            activeWorkoutSplit={activeWorkoutSplit}
            splitTemplates={accountWorkoutSplits}
            profileCountBySplitId={profileCountBySplitId}
            onActivateBuiltInPpl={async () => {
              await activateBuiltInPpl();
              showToast('Switched to PPL');
            }}
            onActivateWorkoutSplit={async (template) => {
              await activateWorkoutSplit(template);
              showToast(`Switched to “${template.splitName}”`);
            }}
            onCreateWorkoutSplit={() => setChoosingCreate(true)}
            onEditWorkoutSplit={(template) =>
              setSplitEditor({ isOpen: true, mode: 'edit', template, backgrounds: draftsFromStored(backgroundsOfSplit(template.id)) })
            }
            onSaveLegacySplit={(splitName, days) => setSplitEditor({ isOpen: true, mode: 'create', splitName, days, backgrounds: NO_BACKGROUNDS })}
            onDuplicateWorkoutSplit={async (sourceName, sourceDays, sourceSplitId) => {
              const copy = await duplicateWorkoutSplit(sourceName, sourceDays, sourceSplitId);
              showToast(`Duplicated as “${copy.splitName}”`);
            }}
            onDeleteWorkoutSplit={async (template) => {
              await deleteWorkoutSplit(template);
              showToast(`Deleted “${template.splitName}” from your account`, 'info');
            }}
          />
        </div>
      </header>

      <ul className="week-grid" aria-label="Days of the week">
        {activeDays.map((day) => (
          <li key={day.id}>
            <DayCard day={day} isToday={day.id === todayId} onSelect={onSelectDay} background={dayBackground(day.id)} />
          </li>
        ))}
      </ul>
      <CreateSplitChooser
        isOpen={choosingCreate}
        splits={accountWorkoutSplits}
        onClose={() => setChoosingCreate(false)}
        onCreateFromScratch={() => {
          setChoosingCreate(false);
          setSplitEditor({ isOpen: true, mode: 'create', splitName: '', days: defaultCustomSchedule(), backgrounds: NO_BACKGROUNDS });
        }}
        onDuplicate={startDuplicate}
      />
      <SplitEditor
        isOpen={splitEditor.isOpen}
        mode={splitEditor.isOpen ? splitEditor.mode : 'create'}
        splitName={splitEditor.isOpen ? (splitEditor.mode === 'edit' ? splitEditor.template.splitName : splitEditor.splitName) : ''}
        days={splitEditor.isOpen ? (splitEditor.mode === 'edit' ? splitEditor.template.days : splitEditor.days) : EMPTY_DAYS}
        backgrounds={splitEditor.isOpen ? splitEditor.backgrounds : NO_BACKGROUNDS}
        actingProfileId={profile.id}
        isNameTaken={(splitName) => isSplitNameTaken(splitName, accountWorkoutSplits, editingTemplateId)}
        sharedProfileCount={editingTemplateId ? profileCountBySplitId.get(editingTemplateId) ?? 0 : 0}
        onClose={() => setSplitEditor({ isOpen: false })}
        onSave={saveSplit}
      />
      <Toast toast={toast} />
    </div>
  );
}

const EMPTY_DAYS: CustomDayPlan[] = [];
