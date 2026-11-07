import { cloudStore } from '../../store/cloudStore';
import type { CustomDayPlan, WorkoutPlanType } from '../../types/gym';
import { DEFAULT_SPLIT_NAME, defaultCustomSchedule, validateCustomSchedule } from '../../utils/workoutPlan';
import { CloudError } from './cloudErrors';
import { upsertRow } from './db';
import type { WorkoutPlanRow } from './rows';

/**
 * One plan row per profile. The custom schedule stays stored when the active
 * type is PPL, so switching back does not lose the edited split.
 */
export const workoutPlanService = {
  async save(profileId: string, planType: WorkoutPlanType, splitName: string, days: readonly CustomDayPlan[]): Promise<void> {
    const schedule = days.length === 0 ? defaultCustomSchedule() : days;
    const name = splitName.trim() || DEFAULT_SPLIT_NAME;
    const problem = validateCustomSchedule(name, schedule);
    if (problem) throw new CloudError(problem, 'validation');
    const row = await upsertRow<WorkoutPlanRow>(
      'profile_workout_plans',
      { profile_id: profileId, plan_type: planType, split_name: name, weekly_schedule: { days: schedule } },
      'profile_id',
      'Could not save the workout split.',
    );
    cloudStore.applyUpserts('profile_workout_plans', [row]);
  },
};
