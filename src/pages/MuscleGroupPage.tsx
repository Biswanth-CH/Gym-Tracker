import { Target } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { MuscleRegionCard } from '../components/workout/MuscleCards';
import { MuscleAnatomyDiagram } from '../components/workout/MuscleAnatomyDiagram';
import type { MuscleGroup, MuscleRegion } from '../types/gym';

interface MuscleGroupPageProps {
  backLabel: string;
  group: MuscleGroup;
  /** Regions to offer: the active split's selection on a workout day, or all of them in the library. */
  regions: readonly MuscleRegion[];
  /** Exercises allowed per region (workout day). Undefined = the whole library. */
  allowedExerciseIdsByRegion?: ReadonlyMap<string, ReadonlySet<string>>;
  onBack: () => void;
  onSelectRegion: (region: MuscleRegion) => void;
}

/** Muscle group name, its anatomy illustration and the selectable target regions — nothing else. */
export function MuscleGroupPage({ backLabel, group, regions, allowedExerciseIdsByRegion, onBack, onSelectRegion }: MuscleGroupPageProps) {
  const regionWord = group.id === 'triceps' ? 'head' : 'region';
  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={backLabel} onClick={onBack} />
      </nav>

      <header className="dashboard-header">
        <h1 className="page-title">{group.name}</h1>
      </header>

      <div className="detail-card anatomy-card">
        <MuscleAnatomyDiagram muscleGroupId={group.id} />
      </div>

      <section className="section" aria-labelledby="regions-heading">
        <h2 id="regions-heading" className="section__title">
          Choose a target {regionWord}
        </h2>
        {regions.length === 0 ? (
          <EmptyState icon={<Target size={28} aria-hidden="true" />} title="No target regions selected" message="This workout day has no regions selected for this muscle group. Edit the split to add some." />
        ) : (
          <ul className="card-list" data-testid="region-list">
            {regions.map((region) => (
              <li key={region.id}>
                <MuscleRegionCard region={region} allowedExerciseIds={allowedExerciseIdsByRegion?.get(region.id)} onSelect={onSelectRegion} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
