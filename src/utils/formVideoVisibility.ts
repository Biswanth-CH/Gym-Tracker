import type { ExerciseFormVideo } from '../types/gym';

/** Oldest first, ties by id (stable on every device). */
const byCreated = (a: ExerciseFormVideo, b: ExerciseFormVideo) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * Shared videos of one variation, split by the selected profile's hidden set.
 * Hiding only affects that profile's view; the shared video list itself is unchanged.
 */
export function splitVisibleVideos(
  videos: readonly ExerciseFormVideo[],
  hiddenIds: ReadonlySet<string>,
): { visible: ExerciseFormVideo[]; hidden: ExerciseFormVideo[] } {
  const sorted = [...videos].sort(byCreated);
  return {
    visible: sorted.filter((video) => !hiddenIds.has(video.id)),
    hidden: sorted.filter((video) => hiddenIds.has(video.id)),
  };
}

/** Phase 8: editing / deleting a shared video affects every account, so both ask first. */
export const EDIT_SHARED_VIDEO_WARNING = 'Editing this form video will update it for all users and profiles. Are you sure you want to continue?';
export const DELETE_SHARED_VIDEO_WARNING = 'Deleting this form video will remove it for all users and profiles. Are you sure you want to continue?';
