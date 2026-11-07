import { useState } from 'react';
import { AlertTriangle, ListChecks, Target, Wrench } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { Toast } from '../components/Toast';
import { DIFFICULTY_LABEL, formatRecommendation } from '../components/workout/ExerciseCard';
import { ExerciseMediaViewer } from '../components/workout/ExerciseMediaViewer';
import { MuscleAnatomyDiagram } from '../components/workout/MuscleAnatomyDiagram';
import { PersonalRecordPanel } from '../components/workout/PersonalRecordPanel';
import { SetTracker } from '../components/workout/SetTracker';
import { TodayVariationToggle } from '../components/workout/TodayVariationToggle';
import { getEquipmentNames } from '../constants/gymEquipment';
import { useDailyTracker, useExerciseSelections, usePersonalRecord, useSetTemplate } from '../hooks/useCloud';
import { useToast } from '../hooks/useToast';
import { useToday } from '../hooks/useToday';
import { errorMessage } from '../services/cloud/cloudErrors';
import type { LibraryExercise, MuscleGroup, MuscleRegion, Profile } from '../types/gym';

interface ExerciseDetailsPageProps {
  profile: Profile;
  group: MuscleGroup;
  region: MuscleRegion;
  exercise: LibraryExercise;
  onBack: () => void;
}

export function ExerciseDetailsPage({ profile, group, region, exercise, onBack }: ExerciseDetailsPageProps) {
  const todayKey = useToday();
  const { toast, showToast } = useToast();
  const { isSelected, select, deselect } = useExerciseSelections(profile.id);
  const { template, save: savePlan } = useSetTemplate(profile.id, exercise.id);
  const { completed, setCompleted } = useDailyTracker(profile.id, exercise.id, todayKey);
  const { record, save: saveRecord, remove: removeRecord } = usePersonalRecord(profile.id, exercise.id);
  const [toggling, setToggling] = useState(false);
  const selectedToday = isSelected(exercise.id, todayKey);
  const needsWeight = exercise.loadType === 'WEIGHTED' || exercise.loadType === 'ASSISTED';

  const toggleToday = async () => {
    setToggling(true);
    try {
      if (selectedToday) {
        await deselect(exercise.id, todayKey);
        showToast('Removed from today’s workout', 'info');
      } else {
        await select(exercise.id, todayKey);
        showToast('Added to today’s workout');
      }
    } catch (error) {
      showToast(errorMessage(error, 'Could not update today’s workout.'), 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="page page--wide page--exercise">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={region.name} onClick={onBack} />
        <span className="top-bar__context">{profile.name}</span>
      </nav>

      {/* 1. Name + target */}
      <header className="exercise-header">
        <p className="eyebrow">
          {group.name} · {region.name}
        </p>
        <h1 className="page-title">{exercise.name}</h1>
        <p className="exercise-header__target">
          <Target size={16} aria-hidden="true" /> Targets <strong>{region.name}</strong> ({region.anatomicalName})
        </p>
      </header>

      {/* 2–3. Large illustrations + equally large target muscle diagram */}
      <div className="exercise-visuals">
        <ExerciseMediaViewer exercise={exercise} />
        <section className="detail-card target-visual" aria-labelledby="target-visual-heading" data-testid="target-diagram">
          <h2 id="target-visual-heading" className="detail-card__title">
            Target muscle
          </h2>
          <MuscleAnatomyDiagram muscleGroupId={group.id} regionId={region.id} size="lg" />
          <p className="target-visual__legend">
            <span className="target-visual__swatch target-visual__swatch--active" aria-hidden="true" /> {region.name}
            <span className="target-visual__swatch target-visual__swatch--group" aria-hidden="true" /> Rest of {group.name.toLowerCase()}
          </p>
        </section>
      </div>

      {/* 4–5. Instructions + mistakes */}
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

      {/* 6–7. Equipment, muscles, difficulty, recommendation */}
      <section className="detail-card exercise-facts" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="detail-card__title">
          Equipment &amp; details
        </h2>
        <dl className="target-card__list">
          <div>
            <dt>Equipment</dt>
            <dd data-testid="equipment">{getEquipmentNames(exercise.equipment).join(', ')}</dd>
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
            <dt>Difficulty</dt>
            <dd>
              <span className={`pill pill--difficulty pill--${exercise.difficulty.toLowerCase()}`}>{DIFFICULTY_LABEL[exercise.difficulty]}</span>
            </dd>
          </div>
          <div>
            <dt>Suggested</dt>
            <dd data-testid="recommended">
              {formatRecommendation(exercise)} {exercise.measure === 'SECONDS' ? '' : 'reps'} <span className="muted">(general starting point)</span>
            </dd>
          </div>
        </dl>
        {exercise.setupNote && (
          <p className="info-note info-note--inline">
            <Wrench size={16} aria-hidden="true" />
            <span>{exercise.setupNote}</span>
          </p>
        )}
      </section>

      {/* 8. Today's variation */}
      <TodayVariationToggle selected={selectedToday} busy={toggling} onToggle={() => void toggleToday()} />

      {/* 9. Set Tracker */}
      <SetTracker
        exercise={exercise}
        template={template}
        completed={completed}
        record={record}
        onSavePlan={(plan) => savePlan(plan, exercise.measure)}
        onSetCompleted={setCompleted}
        onAcceptPr={async (candidate) => {
          await saveRecord(
            { recordDate: todayKey, weight: candidate.weight, unit: candidate.unit, reps: candidate.reps, sets: null, notes: record?.notes ?? null },
            exercise.measure,
            needsWeight,
          );
          showToast('Personal record updated');
        }}
        onToast={showToast}
      />

      {/* 10. Personal Record */}
      <PersonalRecordPanel
        exercise={exercise}
        record={record}
        onSave={(input) => saveRecord(input, exercise.measure, needsWeight)}
        onDelete={removeRecord}
        onToast={showToast}
      />

      <p className="disclaimer">General fitness information, not medical advice. Choose weights you can control with good form.</p>
      <Toast toast={toast} />
    </div>
  );
}
