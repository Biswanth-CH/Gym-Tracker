import { useCallback, useMemo } from 'react';
import { formVideoService } from '../services/cloud/formVideoService';
import { toFormVideo } from '../services/cloud/rows';
import type { ExerciseFormVideo, ExerciseFormVideoInput } from '../types/gym';
import { useCloudSlice } from './useCloud';

/** Saved form-reference videos of one profile for one exercise variation (oldest first). */
export function useFormVideos(profileId: string, exerciseId: string) {
  const rows = useCloudSlice((snapshot) => snapshot.formVideos);
  const phase = useCloudSlice((snapshot) => snapshot.phase);
  const videos: ExerciseFormVideo[] = useMemo(
    () =>
      rows
        .filter((row) => row.profile_id === profileId && row.exercise_id === exerciseId)
        .map(toFormVideo)
        .filter((video): video is ExerciseFormVideo => video !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    [rows, profileId, exerciseId],
  );
  const addVideo = useCallback((input: ExerciseFormVideoInput) => formVideoService.add(profileId, exerciseId, input), [profileId, exerciseId]);
  const updateVideo = useCallback((video: ExerciseFormVideo, input: ExerciseFormVideoInput) => formVideoService.update(video, input), []);
  const deleteVideo = useCallback((videoId: string) => formVideoService.remove(videoId), []);
  return { videos, isLoading: phase === 'loading', addVideo, updateVideo, deleteVideo };
}
