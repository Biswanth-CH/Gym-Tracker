import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { CustomDayPlan, WorkoutPlan, WorkoutSplitTemplate } from '../../types/gym';
import {
  DEFAULT_SPLIT_NAME,
  defaultCustomSchedule,
  duplicateSplitName,
  isSplitNameTaken,
  normalizeSchedule,
  validateCustomSchedule,
} from '../../utils/workoutPlan';
import { CloudError, ensureOk, isMissingColumnError, toCloudError } from './cloudErrors';
import { upsertRow } from './db';
import { toSplitTemplate, type SplitTemplateRow, type WorkoutPlanRow } from './rows';

/**
 * Workout plans (Phase 5)
 *
 *  - `profile_workout_split_templates`: any number of saved custom splits per profile.
 *  - `profile_workout_plans`: one row per profile with the ACTIVE choice:
 *      plan_type 'PPL'    → the built-in split (never stored as a template, never deleted)
 *      plan_type 'CUSTOM' → active_split_template_id
 *    Its legacy `split_name` / `weekly_schedule` columns mirror the active custom split so
 *    older app builds keep showing the right days. Switching to PPL never touches templates.
 */

const SPLIT_MIGRATION_HINT =
  'Saved workout splits need the Phase 5 database update. Run supabase/migrations/20261108_phase5_profile_details_and_workout_splits.sql in Supabase, then try again.';

function isMissingTableError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST205' || code === '42P01' || /could not find the table|schema cache/i.test(message);
}

function splitWriteError(error: unknown, fallback: string): CloudError {
  if (isMissingTableError(error) || isMissingColumnError(error)) return new CloudError(SPLIT_MIGRATION_HINT, 'validation');
  const cloudError = toCloudError(error, fallback);
  if (cloudError.kind === 'conflict') return new CloudError('You already have a split with this name. Choose another name.', 'conflict');
  return cloudError;
}

function validateTemplate(
  splitName: string,
  days: readonly CustomDayPlan[],
  existing: readonly WorkoutSplitTemplate[],
  excludeId?: string,
): CustomDayPlan[] {
  const schedule = normalizeSchedule(days);
  const problem = validateCustomSchedule(splitName, schedule);
  if (problem) throw new CloudError(problem, 'validation');
  if (isSplitNameTaken(splitName, existing, excludeId)) {
    throw new CloudError('You already have a split with this name. Choose another name.', 'conflict');
  }
  return schedule;
}

async function writePlanRow(row: Record<string, unknown>, fallback: string): Promise<void> {
  try {
    const stored = await upsertRow<WorkoutPlanRow>('profile_workout_plans', row, 'profile_id', fallback);
    cloudStore.applyUpserts('profile_workout_plans', [stored]);
  } catch (error) {
    throw splitWriteError(error, fallback);
  }
}

export const workoutPlanService = {
  /** Activates the built-in PPL split. Saved splits and the remembered custom split stay as they are. */
  async activatePpl(profileId: string, currentPlan: WorkoutPlan | null): Promise<void> {
    await writePlanRow(
      {
        profile_id: profileId,
        plan_type: 'PPL',
        split_name: currentPlan?.splitName ?? DEFAULT_SPLIT_NAME,
        weekly_schedule: { days: currentPlan?.days ?? defaultCustomSchedule() },
      },
      'Could not switch to the PPL split.',
    );
  },

  /** Activates a saved split and mirrors it into the legacy columns. */
  async activateTemplate(template: WorkoutSplitTemplate): Promise<void> {
    await writePlanRow(
      {
        profile_id: template.profileId,
        plan_type: 'CUSTOM',
        split_name: template.splitName,
        weekly_schedule: { days: template.days },
        active_split_template_id: template.id,
      },
      'Could not activate the workout split.',
    );
  },
};

export const workoutSplitTemplateService = {
  async create(
    profileId: string,
    splitName: string,
    days: readonly CustomDayPlan[],
    existing: readonly WorkoutSplitTemplate[],
  ): Promise<WorkoutSplitTemplate> {
    const schedule = validateTemplate(splitName, days, existing);
    const fallback = 'Could not create the workout split.';
    const result = await getSupabase()
      .from('profile_workout_split_templates')
      .insert({ profile_id: profileId, split_name: splitName.trim(), weekly_schedule: { days: schedule } })
      .select('*');
    if (result.error) throw splitWriteError(result.error, fallback);
    const row = (result.data as SplitTemplateRow[])[0];
    const template = row ? toSplitTemplate(row) : null;
    if (!row || !template) throw new CloudError(fallback, 'unknown');
    cloudStore.applyUpserts('profile_workout_split_templates', [row]);
    return template;
  },

  /** Renames / edits a saved split. When it is the active split, the plan's mirror is refreshed too. */
  async update(
    template: WorkoutSplitTemplate,
    splitName: string,
    days: readonly CustomDayPlan[],
    existing: readonly WorkoutSplitTemplate[],
    currentPlan: WorkoutPlan | null,
  ): Promise<WorkoutSplitTemplate> {
    const schedule = validateTemplate(splitName, days, existing, template.id);
    const fallback = 'Could not save the workout split.';
    const result = await getSupabase()
      .from('profile_workout_split_templates')
      .update({ split_name: splitName.trim(), weekly_schedule: { days: schedule } })
      .eq('id', template.id)
      .select('*');
    if (result.error) throw splitWriteError(result.error, fallback);
    const row = (result.data as SplitTemplateRow[])[0];
    const updated = row ? toSplitTemplate(row) : null;
    if (!row || !updated) throw new CloudError('This split no longer exists.', 'unknown');
    cloudStore.applyUpserts('profile_workout_split_templates', [row]);
    if (currentPlan?.planType === 'CUSTOM' && currentPlan.activeTemplateId === template.id) {
      await workoutPlanService.activateTemplate(updated);
    }
    return updated;
  },

  /** Copies a saved split (or the built-in PPL days) under a unique "(copy)" name. Not activated. */
  async duplicate(
    profileId: string,
    sourceName: string,
    sourceDays: readonly CustomDayPlan[],
    existing: readonly WorkoutSplitTemplate[],
  ): Promise<WorkoutSplitTemplate> {
    return workoutSplitTemplateService.create(profileId, duplicateSplitName(sourceName, existing), sourceDays, existing);
  },

  /**
   * Deletes one saved split. If it is active, the profile switches to PPL first so the
   * weekly plan never points at a missing split. Other splits are untouched.
   */
  async remove(template: WorkoutSplitTemplate, currentPlan: WorkoutPlan | null): Promise<void> {
    if (currentPlan?.planType === 'CUSTOM' && currentPlan.activeTemplateId === template.id) {
      await workoutPlanService.activatePpl(template.profileId, currentPlan);
    }
    ensureOk(
      await getSupabase().from('profile_workout_split_templates').delete().eq('id', template.id),
      'Could not delete the workout split.',
    );
    cloudStore.applyDeletes('profile_workout_split_templates', (row) => row.id === template.id);
    // The database clears active_split_template_id (ON DELETE SET NULL); re-read the plan row.
    cloudStore.refreshTable('profile_workout_plans');
  },
};
