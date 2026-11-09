import { BackButton } from '../components/BackButton';
import { MuscleGroupCard } from '../components/workout/MuscleCards';
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';
import { MUSCLE_GROUPS } from '../constants/muscleGroups';
import type { MuscleGroup } from '../types/gym';

interface ExerciseLibraryPageProps {
  backLabel: string;
  onBack: () => void;
  onSelectMuscleGroup: (group: MuscleGroup) => void;
}

/** The complete library (all eight groups), independent of any workout split selection. */
export function ExerciseLibraryPage({ backLabel, onBack, onSelectMuscleGroup }: ExerciseLibraryPageProps) {
  return (
    <div className="page page--wide" data-testid="exercise-library">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={backLabel} onClick={onBack} />
      </nav>
      <header className="dashboard-header">
        <h1 className="page-title">Exercise Library</h1>
        <p className="page-subtitle">All {EXERCISE_LIBRARY.length} exercises for your gym, by muscle group.</p>
      </header>
      <ul className="card-list">
        {MUSCLE_GROUPS.map((group) => (
          <li key={group.id}>
            <MuscleGroupCard group={group} onSelect={onSelectMuscleGroup} />
          </li>
        ))}
      </ul>
    </div>
  );
}
