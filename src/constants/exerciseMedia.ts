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

/** Original GymTrack illustrations, served from the site itself (relative path works under /Gym-Tracker/). */
export const CUSTOM_IMAGE_BASE_PATH = 'exercise-images/custom/';

export type ImageSource = 'repdb' | 'custom';

export interface ExerciseImage {
  key: string;
  label: string;
  url: string;
  source: ImageSource;
}

/**
 * Image URLs for an exercise or stretch:
 *  - RepDB: `images/flat/<id>-<start|peak|main>.webp` on RepDB's own site,
 *  - custom: `exercise-images/custom/<id>-<start|peak|main>.svg` in this app.
 */
export function getExerciseImages(media: ExerciseMedia): ExerciseImage[] {
  const id = media.customId ?? media.repdbId;
  if (!id) return [];
  const source: ImageSource = media.customId ? 'custom' : 'repdb';
  const url = (pose: string) =>
    source === 'custom' ? `${CUSTOM_IMAGE_BASE_PATH}${id}-${pose}.svg` : `${REPDB_IMAGE_BASE_URL}images/flat/${id}-${pose}.webp`;
  const images: ExerciseImage[] =
    media.poseCount === 1
      ? [{ key: 'main', label: media.mainLabel ?? 'Position', url: url('main'), source }]
      : [
          { key: 'start', label: 'Start', url: url('start'), source },
          { key: 'peak', label: 'Peak', url: url('peak'), source },
        ];
  for (const alternate of media.alternates ?? []) {
    images.push({ key: alternate.repdbId, label: alternate.label, url: `${REPDB_IMAGE_BASE_URL}images/flat/${alternate.repdbId}-main.webp`, source: 'repdb' });
  }
  return images;
}
