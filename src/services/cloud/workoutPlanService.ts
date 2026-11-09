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
import { toSplitTemplate, toWorkoutPlan, type SplitTemplateRow, type WorkoutPlanRow } from './rows';

/**
 * Workout plans (Phase 6)
 *
 *  - `account_workout_split_templates`: ONE shared library of custom splits per account.
 *    Every profile of the account sees and can activate them; RLS: owner_id = auth.uid().
 *  - `profile_workout_plans`: one row per profile with that profile's ACTIVE choice:
 *      plan_type 'PPL'    → built-in split (never stored as a template, never deleted)
 *      plan_type 'CUSTOM' → active_account_split_id (a trigger checks same-account ownership)
 *    Legacy `split_name` / `weekly_schedule` mirror the active custom split for older builds.
 *  - Editing a shared split changes it for every profile using it. Duplicate to customise
 *    a copy. Switching splits never modifies saved splits.
 */

const SPLIT_MIGRATION_HINT =
  'Shared workout splits need the Phase 6 database update. Run supabase/migrations/20261109_phase6_shared_splits_themes_pins.sql in Supabase, then try again.';

function isMissingTableError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST205' || code === '42P01' || /could not find the table|schema cache/i.test(message);
}

function splitWriteError(error: unknown, fallback: string): CloudError {
  if (isMissingTableError(error) || isMissingColumnError(error)) return new CloudError(SPLIT_MIGRATION_HINT, 'validation');
  return toCloudError(error, fallback);
}

const DUPLICATE_NAME_MESSAGE = 'Your account already has a split with this name. Choose another name.';

function validateTemplate(
  splitName: string,
  days: readonly CustomDayPlan[],
  accountSplits: readonly WorkoutSplitTemplate[],
  excludeId?: string,
): CustomDayPlan[] {
  const schedule = normalizeSchedule(days);
  const problem = validateCustomSchedule(splitName, schedule);
  if (problem) throw new CloudError(problem, 'validation');
  if (isSplitNameTaken(splitName, accountSplits, excludeId)) throw new CloudError(DUPLICATE_NAME_MESSAGE, 'conflict');
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

/** Plans (of any profile in this account) whose active split is this shared template. */
function plansUsingSplit(templateId: string): WorkoutPlan[] {
  return cloudStore
    .getSnapshot()
    .workoutPlans.map(toWorkoutPlan)
    .filter((plan): plan is WorkoutPlan => plan !== null && plan.planType === 'CUSTOM' && plan.activeWorkoutSplitId === templateId);
}

export const workoutPlanService = {
  /** Activates the built-in PPL split for ONE profile. The remembered custom split is kept. */
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

  /** Activates a shared split for ONE profile (other profiles keep their own choice). */
  async activateWorkoutSplit(profileId: string, template: WorkoutSplitTemplate): Promise<void> {
    await writePlanRow(
      {
        profile_id: profileId,
        plan_type: 'CUSTOM',
        split_name: template.splitName,
        weekly_schedule: { days: template.days },
        active_account_split_id: template.id,
      },
      'Could not activate the workout split.',
    );
  },
};

export const workoutSplitTemplateService = {
  /** Creates a shared split for the whole account; `creatorProfileId` is kept as provenance. */
  async create(
    creatorProfileId: string,
    splitName: string,
    days: readonly CustomDayPlan[],
    accountSplits: readonly WorkoutSplitTemplate[],
  ): Promise<WorkoutSplitTemplate> {
    const schedule = validateTemplate(splitName, days, accountSplits);
    const fallback = 'Could not create the workout split.';
    const result = await getSupabase()
      .from('account_workout_split_templates')
      .insert({ source_profile_id: creatorProfileId, split_name: splitName.trim(), weekly_schedule: { days: schedule } })
      .select('*');
    if (result.error) throw splitWriteError(result.error, fallback);
    const row = (result.data as SplitTemplateRow[])[0];
    const template = row ? toSplitTemplate(row) : null;
    if (!row || !template) throw new CloudError(fallback, 'unknown');
    cloudStore.applyUpserts('account_workout_split_templates', [row]);
    return template;
  },

  /**
   * Renames / edits a shared split. Every profile using it sees the change; their
   * legacy mirror columns are refreshed too so older app builds stay consistent.
   */
  async update(
    template: WorkoutSplitTemplate,
    splitName: string,
    days: readonly CustomDayPlan[],
    accountSplits: readonly WorkoutSplitTemplate[],
  ): Promise<WorkoutSplitTemplate> {
    const schedule = validateTemplate(splitName, days, accountSplits, template.id);
    const fallback = 'Could not save the workout split.';
    const result = await getSupabase()
      .from('account_workout_split_templates')
      .update({ split_name: splitName.trim(), weekly_schedule: { days: schedule } })
      .eq('id', template.id)
      .select('*');
    if (result.error) throw splitWriteError(result.error, fallback);
    const row = (result.data as SplitTemplateRow[])[0];
    const updated = row ? toSplitTemplate(row) : null;
    if (!row || !updated) throw new CloudError('This split no longer exists.', 'unknown');
    cloudStore.applyUpserts('account_workout_split_templates', [row]);
    for (const plan of plansUsingSplit(template.id)) {
      await workoutPlanService.activateWorkoutSplit(plan.profileId, updated);
    }
    return updated;
  },

  /** Independent copy under a unique "(copy)" name. Not activated. */
  duplicate(
    creatorProfileId: string,
    sourceName: string,
    sourceDays: readonly CustomDayPlan[],
    accountSplits: readonly WorkoutSplitTemplate[],
  ): Promise<WorkoutSplitTemplate> {
    return workoutSplitTemplateService.create(creatorProfileId, duplicateSplitName(sourceName, accountSplits), sourceDays, accountSplits);
  },

  /** Number of profiles whose ACTIVE split is this one (for the delete warning). */
  countProfilesUsing(templateId: string): number {
    return plansUsingSplit(templateId).length;
  },

  /**
   * Deletes a shared split. Every profile that has it active switches to PPL first, so no
   * weekly plan points at a missing split. Other splits are untouched.
   */
  async remove(template: WorkoutSplitTemplate): Promise<void> {
    for (const plan of plansUsingSplit(template.id)) {
      await workoutPlanService.activatePpl(plan.profileId, plan);
    }
    ensureOk(await getSupabase().from('account_workout_split_templates').delete().eq('id', template.id), 'Could not delete the workout split.');
    cloudStore.applyDeletes('account_workout_split_templates', (row) => row.id === template.id);
    // The database clears active_account_split_id where it was remembered (ON DELETE SET NULL).
    cloudStore.refreshTable('profile_workout_plans');
  },
};
