import { BackButton } from '../components/BackButton';
import { MuscleRegionCard } from '../components/workout/MuscleCards';
import { MuscleAnatomyDiagram } from '../components/workout/MuscleAnatomyDiagram';
import type { MuscleGroup, MuscleRegion, Profile, WorkoutDay } from '../types/gym';

interface MuscleGroupPageProps {
  profile: Profile;
  day: WorkoutDay;
  group: MuscleGroup;
  onBack: () => void;
  onSelectRegion: (region: MuscleRegion) => void;
}

/** Muscle group name, its anatomy illustration and the selectable target regions — nothing else. */
export function MuscleGroupPage({ day, group, onBack, onSelectRegion }: MuscleGroupPageProps) {
  const regionWord = group.id === 'triceps' ? 'head' : 'region';
  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={day.dayName} onClick={onBack} />
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
        <ul className="card-list">
          {group.regions.map((region) => (
            <li key={region.id}>
              <MuscleRegionCard region={region} onSelect={onSelectRegion} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
