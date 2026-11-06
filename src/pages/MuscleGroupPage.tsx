import { Info } from 'lucide-react';
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

export function MuscleGroupPage({ profile, day, group, onBack, onSelectRegion }: MuscleGroupPageProps) {
  const regionWord = group.id === 'triceps' ? 'head' : 'region';
  return (
    <div className="page page--wide">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={day.dayName} onClick={onBack} />
        <span className="top-bar__context">{profile.name}</span>
      </nav>

      <header className="dashboard-header">
        <p className="eyebrow">{day.dayName} · Muscle group</p>
        <h1 className="page-title">{group.name}</h1>
        <p className="page-subtitle">{group.description}</p>
      </header>

      <div className="detail-card anatomy-card">
        <MuscleAnatomyDiagram muscleGroupId={group.id} />
      </div>

      <p className="info-note">
        <Info size={16} aria-hidden="true" />
        <span>{group.emphasisNote}</span>
      </p>

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
