import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { ExerciseFormVideo, ExerciseFormVideoInput } from '../../types/gym';
import { isFormVideoPlatform, parseVideoUrl, validateVideoName } from '../../utils/formVideoLinks';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import type { FormVideoRow } from './rows';

/**
 * Form-reference videos per profile + exercise variation (`profile_exercise_form_videos`).
 * RLS (`owns_gym_profile`) limits every row to the signed-in account. URLs are validated
 * here and by CHECK constraints in the database; only http(s) links are ever stored.
 */

const MIGRATION_HINT =
  'Form videos need the Phase 7 database update. Run supabase/migrations/20261124_phase7_form_videos_custom_theme.sql in Supabase, then try again.';

function isMissingTableError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST205' || code === '42P01' || /could not find the table|schema cache/i.test(message);
}

function writeError(error: unknown, fallback: string): CloudError {
  return isMissingTableError(error) ? new CloudError(MIGRATION_HINT, 'validation') : toCloudError(error, fallback);
}

/** Validates and normalises the form; throws a user-facing CloudError. */
export function validateFormVideoInput(input: ExerciseFormVideoInput): { video_name: string; video_url: string; platform: string } {
  const nameProblem = validateVideoName(input.videoName);
  if (nameProblem) throw new CloudError(nameProblem, 'validation');
  const parsed = parseVideoUrl(input.videoUrl);
  if (!parsed.ok) throw new CloudError(parsed.error, 'validation');
  if (!isFormVideoPlatform(input.platform)) throw new CloudError('Choose YouTube, Instagram or Other.', 'validation');
  return { video_name: input.videoName.trim(), video_url: parsed.url, platform: input.platform };
}

export const formVideoService = {
  async add(profileId: string, exerciseId: string, input: ExerciseFormVideoInput): Promise<void> {
    const values = validateFormVideoInput(input);
    const result = await getSupabase()
      .from('profile_exercise_form_videos')
      .insert({ profile_id: profileId, exercise_id: exerciseId, ...values })
      .select('*');
    if (result.error) throw writeError(result.error, 'Could not save the video.');
    cloudStore.applyUpserts('profile_exercise_form_videos', result.data as FormVideoRow[]);
  },

  async update(video: ExerciseFormVideo, input: ExerciseFormVideoInput): Promise<void> {
    const values = validateFormVideoInput(input);
    const result = await getSupabase().from('profile_exercise_form_videos').update(values).eq('id', video.id).select('*');
    if (result.error) throw writeError(result.error, 'Could not update the video.');
    const rows = result.data as FormVideoRow[];
    if (rows.length === 0) throw new CloudError('This video no longer exists.', 'unknown');
    cloudStore.applyUpserts('profile_exercise_form_videos', rows);
  },

  async remove(videoId: string): Promise<void> {
    ensureOk(await getSupabase().from('profile_exercise_form_videos').delete().eq('id', videoId), 'Could not delete the video.');
    cloudStore.applyDeletes('profile_exercise_form_videos', (row) => row.id === videoId);
  },
};
