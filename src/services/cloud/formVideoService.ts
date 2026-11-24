import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { ExerciseFormVideo, ExerciseFormVideoInput } from '../../types/gym';
import { isFormVideoPlatform, parseVideoUrl, validateVideoName } from '../../utils/formVideoLinks';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import type { FormVideoRow, HiddenFormVideoRow } from './rows';

/**
 * Form-reference videos (Phase 8): SHARED by every signed-in account, per exercise
 * variation (`exercise_form_videos`). RLS: any signed-in user can read and add; only the
 * adding account (created_by) can edit or delete. Hiding is per profile and private
 * (`profile_hidden_form_videos`). URLs are validated here and by CHECK constraints in
 * the database; only http(s) links are ever stored.
 */

const MIGRATION_HINT =
  'Shared form videos need the Phase 8 database update. Run supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql in Supabase, then try again.';

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

function isDuplicateError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown };
  return like.code === '23505';
}

export const formVideoService = {
  async add(exerciseId: string, input: ExerciseFormVideoInput): Promise<void> {
    const values = validateFormVideoInput(input);
    // created_by defaults to auth.uid() in the database (and RLS requires exactly that).
    const result = await getSupabase().from('exercise_form_videos').insert({ exercise_id: exerciseId, ...values }).select('*');
    if (result.error) {
      if (isDuplicateError(result.error)) throw new CloudError('This link is already shared for this variation.', 'conflict');
      throw writeError(result.error, 'Could not save the video.');
    }
    cloudStore.applyUpserts('exercise_form_videos', result.data as FormVideoRow[]);
  },

  /** Updates the shared video for everyone (only its creator may; RLS enforces it). */
  async update(video: ExerciseFormVideo, input: ExerciseFormVideoInput): Promise<void> {
    const values = validateFormVideoInput(input);
    const result = await getSupabase().from('exercise_form_videos').update(values).eq('id', video.id).select('*');
    if (result.error) {
      if (isDuplicateError(result.error)) throw new CloudError('This link is already shared for this variation.', 'conflict');
      throw writeError(result.error, 'Could not update the video.');
    }
    const rows = result.data as FormVideoRow[];
    if (rows.length === 0) throw new CloudError('Only the account that added this video can edit it, or it no longer exists.', 'permission');
    cloudStore.applyUpserts('exercise_form_videos', rows);
  },

  /** Deletes the shared video for everyone (only its creator may). */
  async remove(videoId: string): Promise<void> {
    const result = await getSupabase().from('exercise_form_videos').delete().eq('id', videoId).select('id');
    const rows = ensureOk(result, 'Could not delete the video.') as Array<{ id: string }>;
    if (rows.length === 0) throw new CloudError('Only the account that added this video can delete it, or it no longer exists.', 'permission');
    cloudStore.applyDeletes('exercise_form_videos', (row) => row.id === videoId);
    cloudStore.applyDeletes('profile_hidden_form_videos', (row) => row.video_id === videoId);
  },

  /** Hides a shared video for ONE profile (private; the video itself is untouched). */
  async hide(profileId: string, videoId: string): Promise<void> {
    const result = await getSupabase()
      .from('profile_hidden_form_videos')
      // ON CONFLICT DO NOTHING: hiding twice is harmless (and needs no UPDATE right).
      .upsert({ profile_id: profileId, video_id: videoId }, { onConflict: 'profile_id,video_id', ignoreDuplicates: true })
      .select('*');
    if (result.error) throw writeError(result.error, 'Could not hide the video.');
    const rows = result.data as HiddenFormVideoRow[];
    if (rows.length > 0) cloudStore.applyUpserts('profile_hidden_form_videos', rows);
    else cloudStore.refreshTable('profile_hidden_form_videos');
  },

  async unhide(profileId: string, videoId: string): Promise<void> {
    const result = await getSupabase().from('profile_hidden_form_videos').delete().eq('profile_id', profileId).eq('video_id', videoId);
    if (result.error) throw writeError(result.error, 'Could not unhide the video.');
    cloudStore.applyDeletes('profile_hidden_form_videos', (row) => row.profile_id === profileId && row.video_id === videoId);
  },
};
