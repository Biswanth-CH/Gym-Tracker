import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ListChecks, Trash2, Wrench } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { DIFFICULTY_LABEL, formatRecommendation } from '../components/workout/ExerciseCard';
import { ExerciseMediaViewer } from '../components/workout/ExerciseMediaViewer';
import { MuscleAnatomyDiagram } from '../components/workout/MuscleAnatomyDiagram';
import { PersonalRecordCard } from '../components/workout/PersonalRecordCard';
import { PreviousWorkoutSummary } from '../components/workout/PreviousWorkoutSummary';
import { WorkoutHistoryList } from '../components/workout/WorkoutHistoryList';
import { WorkoutLogger } from '../components/workout/WorkoutLogger';
import { getEquipmentNames } from '../constants/gymEquipment';
import { useToast } from '../hooks/useToast';
import { useToday } from '../hooks/useToday';
import { useExerciseWorkout } from '../hooks/useWorkoutLogs';
import type { DateKey, LibraryExercise, MuscleGroup, MuscleRegion, Profile } from '../types/gym';
import { formatShortDate } from '../utils/dateUtils';
import { computePersonalRecords } from '../utils/personalRecords';

interface ExerciseDetailsPageProps {
  profile: Profile;
  group: MuscleGroup;
  region: MuscleRegion;
  exercise: LibraryExercise;
  onBack: () => void;
}

export function ExerciseDetailsPage({ profile, group, region, exercise, onBack }: ExerciseDetailsPageProps) {
  const todayKey = useToday();
  const { logs, preference, loadError, saveSession, deleteSession, updatePreference } = useExerciseWorkout(profile.id, exercise.id);
  const { toast, showToast } = useToast();
  const [date, setDate] = useState<DateKey>(todayKey);
  const [pendingDelete, setPendingDelete] = useState<DateKey | null>(null);
  const [usePreviousSignal, setUsePreviousSignal] = useState(0);
  const dirtyRef = useRef(false);
  const loggerRef = useRef<HTMLDivElement>(null);

  const records = useMemo(() => computePersonalRecords(logs, exercise), [logs, exercise]);
  const previous = logs.find((log) => log.date < date) ?? null;

  const requestDate = (next: DateKey) => {
    if (next === date) return;
    if (dirtyRef.current && !window.confirm('Discard your unsaved changes to this session?')) return;
    setDate(next);
  };

  const handleUpdatePreference = (changes: Parameters<typeof updatePreference>[0]) => {
    try {
      updatePreference(changes);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the working weight.', 'error');
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    try {
      deleteSession(pendingDelete);
      showToast(`Deleted session from ${formatShortDate(pendingDelete)}`, 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete this session.', 'error');
    }
    setPendingDelete(null);
  };

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={region.name} onClick={onBack} />
        <span className="top-bar__context">{profile.name}</span>
      </nav>

      <header className="exercise-header">
        <p className="eyebrow">
          {group.name} · {region.name}
        </p>
        <h1 className="page-title">{exercise.name}</h1>
        <div className="exercise-header__chips">
          <span className={`pill pill--difficulty pill--${exercise.difficulty.toLowerCase()}`}>{DIFFICULTY_LABEL[exercise.difficulty]}</span>
          <span className="pill">{exercise.category === 'MACHINE' ? 'Machines & Cables' : 'Alternative'}</span>
          <span className="pill" data-testid="recommended">
            Suggested: {formatRecommendation(exercise)} {exercise.measure === 'SECONDS' ? '' : 'reps'}
          </span>
        </div>
      </header>

      {loadError && (
        <p className="inline-alert" role="alert">
          {loadError}
        </p>
      )}

      <div className="exercise-layout">
        <div className="exercise-layout__media">
          <ExerciseMediaViewer exercise={exercise} />
        </div>

        <div className="exercise-layout__logger" ref={loggerRef}>
          <WorkoutLogger
            exercise={exercise}
            logs={logs}
            preference={preference}
            todayKey={todayKey}
            date={date}
            onRequestDate={requestDate}
            onDirtyChange={(dirty) => {
              dirtyRef.current = dirty;
            }}
            onSave={saveSession}
            onRequestDelete={setPendingDelete}
            onUpdatePreference={handleUpdatePreference}
            onToast={showToast}
            usePreviousSignal={usePreviousSignal}
          />
        </div>
      </div>

      <div className="two-col">
        <PreviousWorkoutSummary exercise={exercise} previous={previous} onUseAsStart={() => setUsePreviousSignal((n) => n + 1)} />
        <PersonalRecordCard exercise={exercise} records={records} displayUnit={preference.weightUnit} />
      </div>

      <section className="detail-card target-card" aria-labelledby="target-heading">
        <h2 id="target-heading" className="detail-card__title">
          Target muscles
        </h2>
        <div className="target-card__layout">
          <MuscleAnatomyDiagram muscleGroupId={group.id} regionId={region.id} size="sm" />
          <dl className="target-card__list">
            <div>
              <dt>Target</dt>
              <dd>
                {group.name} — {region.name}
              </dd>
            </div>
            <div>
              <dt>Primary</dt>
              <dd>{exercise.primaryMuscles.join(', ')}</dd>
            </div>
            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <dt>Also works</dt>
                <dd>{exercise.secondaryMuscles.join(', ')}</dd>
              </div>
            )}
            <div>
              <dt>Equipment</dt>
              <dd data-testid="equipment">{getEquipmentNames(exercise.equipment).join(', ')}</dd>
            </div>
          </dl>
        </div>
        {exercise.setupNote && (
          <p className="info-note info-note--inline">
            <Wrench size={16} aria-hidden="true" />
            <span>{exercise.setupNote}</span>
          </p>
        )}
      </section>

      <div className="two-col">
        <section className="detail-card" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="detail-card__title">
            <ListChecks size={16} aria-hidden="true" /> How to do it
          </h2>
          <ol className="steps">
            {exercise.instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="detail-card" aria-labelledby="mistakes-heading">
          <h2 id="mistakes-heading" className="detail-card__title">
            <AlertTriangle size={16} aria-hidden="true" /> Common mistakes
          </h2>
          <ul className="mistakes">
            {exercise.commonMistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </section>
      </div>

      <WorkoutHistoryList
        exercise={exercise}
        logs={logs}
        prSessionDates={records.prSessionDates}
        selectedDate={date}
        onEdit={(next) => {
          requestDate(next);
          loggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onDelete={setPendingDelete}
      />

      <p className="disclaimer">
        General fitness information, not medical advice. Choose weights you can control with good form.
      </p>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete this session?"
        description={pendingDelete ? `The ${exercise.name} session from ${formatShortDate(pendingDelete)} will be removed. Personal records are recalculated automatically.` : ''}
        confirmLabel="Delete"
        destructive
        icon={<Trash2 size={24} aria-hidden="true" />}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      <Toast toast={toast} />
    </div>
  );
}
