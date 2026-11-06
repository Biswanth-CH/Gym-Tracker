import type { ExerciseMedia } from '../types/gym';

/**
 * Exercise illustrations come from the RepDB free tier
 * (https://github.com/RepDB/exercise-dataset), licensed for in-app use with
 * attribution. Images are loaded from RepDB's own published copy of the free
 * dataset rather than re-hosted here, so this app never redistributes the
 * dataset. Paid-tier preview animations are NOT used (evaluation-only).
 *
 * To self-host later, copy only the images you use and change this base URL.
 */
export const REPDB_IMAGE_BASE_URL = 'https://exercise-dataset.com/';

export const REPDB_ATTRIBUTION = {
  text: 'Exercise data by RepDB (repdb.co)',
  url: 'https://repdb.co',
  licenseUrl: 'https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md',
} as const;

export interface ExerciseImage {
  key: 'start' | 'peak' | 'main';
  label: string;
  url: string;
}

/** Image URLs for an exercise, following the RepDB path convention `images/flat/<id>-<pose>.webp`. */
export function getExerciseImages(media: ExerciseMedia): ExerciseImage[] {
  if (!media.repdbId) return [];
  const url = (pose: string) => `${REPDB_IMAGE_BASE_URL}images/flat/${media.repdbId}-${pose}.webp`;
  if (media.poseCount === 1) return [{ key: 'main', label: 'Position', url: url('main') }];
  return [
    { key: 'start', label: 'Start', url: url('start') },
    { key: 'peak', label: 'Peak', url: url('peak') },
  ];
}
