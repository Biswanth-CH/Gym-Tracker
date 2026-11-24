import { useCallback, useMemo } from 'react';
import { formVideoService } from '../services/cloud/formVideoService';
import { toFormVideo } from '../services/cloud/rows';
import type { ExerciseFormVideo, ExerciseFormVideoInput } from '../types/gym';
import { splitVisibleVideos } from '../utils/formVideoVisibility';
import { useCloudSlice } from './useCloud';

/**
 * Shared form-reference videos of one exercise variation (Phase 8: every account sees them),
 * split into the ones this profile shows and the ones it has hidden. `canModify` is true
 * for videos the signed-in account added (only those can be edited / deleted).
 */
export function useFormVideos(profileId: string, exerciseId: string) {
  const rows = useCloudSlice((snapshot) => snapshot.formVideos);
  const hiddenRows = useCloudSlice((snapshot) => snapshot.hiddenFormVideos);
  const userId = useCloudSlice((snapshot) => snapshot.userId);
  const phase = useCloudSlice((snapshot) => snapshot.phase);

  const { visible, hidden } = useMemo(() => {
    const all = rows
      .filter((row) => row.exercise_id === exerciseId)
      .map(toFormVideo)
      .filter((video): video is ExerciseFormVideo => video !== null);
    const hiddenIds = new Set(hiddenRows.filter((row) => row.profile_id === profileId).map((row) => row.video_id));
    return splitVisibleVideos(all, hiddenIds);
  }, [rows, hiddenRows, profileId, exerciseId]);

  const canModify = useCallback((video: ExerciseFormVideo) => Boolean(userId) && video.createdBy === userId, [userId]);
  const addVideo = useCallback((input: ExerciseFormVideoInput) => formVideoService.add(exerciseId, input), [exerciseId]);
  const updateVideo = useCallback((video: ExerciseFormVideo, input: ExerciseFormVideoInput) => formVideoService.update(video, input), []);
  const deleteVideo = useCallback((videoId: string) => formVideoService.remove(videoId), []);
  const hideVideo = useCallback((videoId: string) => formVideoService.hide(profileId, videoId), [profileId]);
  const unhideVideo = useCallback((videoId: string) => formVideoService.unhide(profileId, videoId), [profileId]);

  return { videos: visible, hiddenVideos: hidden, isLoading: phase === 'loading', canModify, addVideo, updateVideo, deleteVideo, hideVideo, unhideVideo };
}
