import { ChevronRight } from 'lucide-react';
import { getExercisesForRegion } from '../../constants/exerciseLibrary';
import type { MuscleGroup, MuscleRegion } from '../../types/gym';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';

function countExercises(regions: MuscleRegion[]): number {
  const ids = new Set(regions.flatMap((region) => getExercisesForRegion(region.id).map((exercise) => exercise.id)));
  return ids.size;
}

export function MuscleGroupCard({ group, onSelect }: { group: MuscleGroup; onSelect: (group: MuscleGroup) => void }) {
  return (
    <button type="button" className="muscle-card" onClick={() => onSelect(group)} data-muscle={group.id}>
      <span className="muscle-card__diagram">
        <MuscleAnatomyDiagram muscleGroupId={group.id} size="sm" compact />
      </span>
      <span className="muscle-card__body">
        <span className="muscle-card__name">{group.name}</span>
        <span className="muscle-card__meta">
          {group.regions.length} {group.id === 'triceps' ? 'heads' : 'regions'} · {countExercises(group.regions)} exercises
        </span>
        <span className="muscle-card__regions">{group.regions.map((region) => region.name).join(' · ')}</span>
      </span>
      <ChevronRight size={20} className="muscle-card__chevron" aria-hidden="true" />
    </button>
  );
}

export function MuscleRegionCard({ region, onSelect }: { region: MuscleRegion; onSelect: (region: MuscleRegion) => void }) {
  const machines = getExercisesForRegion(region.id, 'MACHINE').length;
  const alternatives = getExercisesForRegion(region.id, 'ALTERNATIVE').length;
  return (
    <button type="button" className="muscle-card muscle-card--region" onClick={() => onSelect(region)} data-region={region.id}>
      <span className="muscle-card__diagram">
        <MuscleAnatomyDiagram muscleGroupId={region.muscleGroupId} regionId={region.id} size="sm" compact />
      </span>
      <span className="muscle-card__body">
        <span className="muscle-card__name">{region.name}</span>
        <span className="muscle-card__anatomical">{region.anatomicalName}</span>
        <span className="muscle-card__meta">
          {machines} machine & cable · {alternatives} alternatives
        </span>
      </span>
      <ChevronRight size={20} className="muscle-card__chevron" aria-hidden="true" />
    </button>
  );
}
