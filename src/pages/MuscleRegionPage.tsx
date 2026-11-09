import { useId } from 'react';
import { Cable, Dumbbell } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { MuscleAnatomyDiagram } from '../components/workout/MuscleAnatomyDiagram';
import { getExercisesForRegion } from '../constants/exerciseLibrary';
import { useExerciseSelections, usePersonalRecordsByExercise } from '../hooks/useCloud';
import { useToday } from '../hooks/useToday';
import type { ExerciseCategory, LibraryExercise, MuscleGroup, MuscleRegion, Profile } from '../types/gym';

interface MuscleRegionPageProps {
  profile: Profile;
  group: MuscleGroup;
  region: MuscleRegion;
  category: ExerciseCategory;
  /** Exercise variations chosen in the active split for this day. Undefined = the whole library. */
  allowedExerciseIds?: ReadonlySet<string>;
  onBack: () => void;
  onChangeCategory: (category: ExerciseCategory) => void;
  onSelectExercise: (exercise: LibraryExercise) => void;
}

const TABS: Array<{ id: ExerciseCategory; label: string }> = [
  { id: 'MACHINE', label: 'Machines & Cables' },
  { id: 'ALTERNATIVE', label: 'Alternatives' },
];

export function MuscleRegionPage({ profile, group, region, category, allowedExerciseIds, onBack, onChangeCategory, onSelectExercise }: MuscleRegionPageProps) {
  const records = usePersonalRecordsByExercise(profile.id);
  const { isSelected } = useExerciseSelections(profile.id);
  const todayKey = useToday();
  const tabsId = useId();
  // On a workout day only the split's chosen variations are listed; the library shows everything.
  const exercisesFor = (tab: ExerciseCategory) =>
    getExercisesForRegion(region.id, tab).filter((exercise) => !allowedExerciseIds || allowedExerciseIds.has(exercise.id));
  const exercises = exercisesFor(category);
  const counts = { MACHINE: exercisesFor('MACHINE').length, ALTERNATIVE: exercisesFor('ALTERNATIVE').length };

  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={group.name} onClick={onBack} />
      </nav>

      <header className="region-header">
        <div className="region-header__text">
          <p className="eyebrow">{group.name}</p>
          <h1 className="page-title">{region.name}</h1>
          <p className="region-header__anatomical">{region.anatomicalName}</p>
          <p className="page-subtitle">{region.description}</p>
        </div>
        <div className="region-header__diagram">
          <MuscleAnatomyDiagram muscleGroupId={group.id} regionId={region.id} size="sm" />
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Exercise category">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${tabsId}-${tab.id}`}
            aria-selected={category === tab.id}
            aria-controls={`${tabsId}-panel`}
            className={`tabs__tab${category === tab.id ? ' is-active' : ''}`}
            onClick={() => onChangeCategory(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            {tab.id === 'MACHINE' ? <Cable size={16} aria-hidden="true" /> : <Dumbbell size={16} aria-hidden="true" />}
            {tab.label}
            <span className="tabs__count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${category}`} className="tab-panel">
        {exercises.length === 0 ? (
          <EmptyState
            icon={category === 'MACHINE' ? <Cable size={28} aria-hidden="true" /> : <Dumbbell size={28} aria-hidden="true" />}
            title={allowedExerciseIds ? "Not in today's selection" : 'Nothing here with your equipment'}
            message={
              allowedExerciseIds
                ? 'None of the variations chosen for this workout day are in this tab. Check the other tab, or edit the split.'
                : category === 'MACHINE'
                ? 'None of the machines in your gym target this region directly. See the Alternatives tab.'
                : 'No free-weight alternatives are listed for this region yet. See the Machines & Cables tab.'
            }
          />
        ) : (
          <ul className="card-list">
            {exercises.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} record={records.get(exercise.id)} selectedToday={isSelected(exercise.id, todayKey)} onSelect={onSelectExercise} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
