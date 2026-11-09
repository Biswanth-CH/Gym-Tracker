import { ChevronRight } from 'lucide-react';
import { getExercisesForRegion } from '../../constants/exerciseLibrary';
import type { MuscleGroup, MuscleRegion } from '../../types/gym';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';

interface MuscleGroupCardProps {
  group: MuscleGroup;
  /** Regions to count / list (the day's selection). Defaults to every region of the group. */
  regions?: readonly MuscleRegion[];
  /** Exercise count to show (the day's selection). Defaults to the whole library. */
  exerciseCount?: number;
  onSelect: (group: MuscleGroup) => void;
}

function countLibraryExercises(regions: readonly MuscleRegion[]): number {
  return new Set(regions.flatMap((region) => getExercisesForRegion(region.id).map((exercise) => exercise.id))).size;
}

export function MuscleGroupCard({ group, regions = group.regions, exerciseCount, onSelect }: MuscleGroupCardProps) {
  const regionWord = group.id === 'triceps' ? 'heads' : 'regions';
  const exercises = exerciseCount ?? countLibraryExercises(regions);
  return (
    <button type="button" className="muscle-card" onClick={() => onSelect(group)} data-muscle={group.id}>
      <span className="muscle-card__diagram">
        <MuscleAnatomyDiagram muscleGroupId={group.id} size="sm" compact />
      </span>
      <span className="muscle-card__body">
        <span className="muscle-card__name">{group.name}</span>
        <span className="muscle-card__meta">
          {regions.length === group.regions.length ? `${regions.length} ${regionWord}` : `${regions.length} of ${group.regions.length} ${regionWord}`} ·{' '}
          {exercises} {exercises === 1 ? 'exercise' : 'exercises'}
        </span>
        <span className="muscle-card__regions">{regions.map((region) => region.name).join(' · ')}</span>
      </span>
      <ChevronRight size={20} className="muscle-card__chevron" aria-hidden="true" />
    </button>
  );
}

interface MuscleRegionCardProps {
  region: MuscleRegion;
  /** Exercises allowed by the active split. Undefined = the whole library. */
  allowedExerciseIds?: ReadonlySet<string>;
  onSelect: (region: MuscleRegion) => void;
}

export function MuscleRegionCard({ region, allowedExerciseIds, onSelect }: MuscleRegionCardProps) {
  const isAllowed = (exerciseId: string) => !allowedExerciseIds || allowedExerciseIds.has(exerciseId);
  const machines = getExercisesForRegion(region.id, 'MACHINE').filter((exercise) => isAllowed(exercise.id)).length;
  const alternatives = getExercisesForRegion(region.id, 'ALTERNATIVE').filter((exercise) => isAllowed(exercise.id)).length;
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
