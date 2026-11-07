import { getStretchById } from '../constants/stretches';
import type { MuscleGroupId, Stretch, StretchPhase } from '../types/gym';

/**
 * Pre-workout entries are dynamic warm-ups. Post-workout entries are static
 * cooldowns. Shared stretches are listed once, in the order of the day's groups.
 */
const PRE_BY_GROUP: Record<MuscleGroupId, readonly string[]> = {
  chest: ['dynamic-chest-opener', 'arm-circles'],
  shoulders: ['arm-circles', 'shoulder-wall-slides'],
  triceps: ['band-external-rotation', 'arm-circles'],
  back: ['scapular-retractions', 'thoracic-rotation'],
  biceps: ['arm-swings'],
  forearms: ['wrist-circles'],
  legs: ['leg-swings-front-back', 'leg-swings-side', 'hip-circles', 'bodyweight-squat-warmup'],
  abs: ['thoracic-rotation', 'hip-circles'],
};

const POST_BY_GROUP: Record<MuscleGroupId, readonly string[]> = {
  chest: ['doorway-chest-stretch'],
  shoulders: ['cross-body-shoulder-stretch', 'front-shoulder-stretch'],
  triceps: ['overhead-triceps-stretch'],
  back: ['lat-stretch', 'childs-pose'],
  biceps: ['biceps-wall-stretch'],
  forearms: ['forearm-flexor-stretch', 'forearm-extensor-stretch'],
  legs: ['standing-quad-stretch', 'hamstring-stretch', 'figure-four-glute-stretch', 'standing-calf-stretch', 'butterfly-adductor-stretch'],
  abs: ['cobra-stretch', 'childs-pose', 'standing-side-stretch'],
};

function collect(groupIds: readonly MuscleGroupId[], idsByGroup: Record<MuscleGroupId, readonly string[]>, phase: StretchPhase): Stretch[] {
  const seen = new Set<string>();
  const stretches: Stretch[] = [];
  for (const groupId of groupIds) {
    for (const stretchId of idsByGroup[groupId]) {
      if (seen.has(stretchId)) continue;
      const stretch = getStretchById(stretchId);
      if (!stretch || stretch.phase !== phase) continue;
      seen.add(stretchId);
      stretches.push(stretch);
    }
  }
  return stretches;
}

export function stretchesForMuscleGroups(groupIds: readonly MuscleGroupId[], phase: StretchPhase): Stretch[] {
  return collect(groupIds, phase === 'WARMUP' ? PRE_BY_GROUP : POST_BY_GROUP, phase);
}
