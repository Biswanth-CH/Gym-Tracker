import { useCallback, useMemo } from 'react';
import { toWorkoutPlan } from '../services/cloud/rows';
import { workoutPlanService } from '../services/cloud/workoutPlanService';
import type { CustomDayPlan, WorkoutDay, WorkoutPlanType } from '../types/gym';
import { DEFAULT_SPLIT_NAME, defaultCustomSchedule, resolveActiveSchedule } from '../utils/workoutPlan';
import { useCloudSlice } from './useCloud';

/** Active weekly plan for one profile. Missing cloud rows mean the built-in PPL split. */
export function useWorkoutPlan(profileId: string) {
  const rows = useCloudSlice((snapshot) => snapshot.workoutPlans);
  const plan = useMemo(() => {
    const row = rows.find((candidate) => candidate.profile_id === profileId);
    return row ? toWorkoutPlan(row) : null;
  }, [rows, profileId]);

  const activeDays: readonly WorkoutDay[] = useMemo(() => resolveActiveSchedule(plan), [plan]);
  const planType: WorkoutPlanType = plan?.planType ?? 'PPL';
  const splitName = plan?.splitName ?? DEFAULT_SPLIT_NAME;
  const customDays = plan?.days ?? defaultCustomSchedule();

  const saveCustom = useCallback(
    (nextName: string, days: readonly CustomDayPlan[], nextType: WorkoutPlanType = planType) =>
      workoutPlanService.save(profileId, nextType, nextName, days),
    [profileId, planType],
  );

  const setPlanType = useCallback(
    (nextType: WorkoutPlanType) => workoutPlanService.save(profileId, nextType, splitName, customDays),
    [profileId, splitName, customDays],
  );

  return { plan, planType, splitName, customDays, activeDays, saveCustom, setPlanType };
}
