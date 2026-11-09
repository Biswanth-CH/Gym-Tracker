import { useCallback, useMemo } from 'react';
import { toSplitTemplate, toWorkoutPlan } from '../services/cloud/rows';
import { workoutPlanService, workoutSplitTemplateService } from '../services/cloud/workoutPlanService';
import type { ActiveWorkoutSplit, CustomDayPlan, WorkoutDay, WorkoutSplitTemplate } from '../types/gym';
import { activeSplitDays, activeSplitName, resolveActiveSplit } from '../utils/workoutPlan';
import { useCloudSlice } from './useCloud';

/**
 * One profile's ACTIVE weekly plan plus the account-wide shared split library.
 * Missing plan rows mean the built-in PPL split. Activating a split only affects `profileId`.
 */
export function useWorkoutPlan(profileId: string) {
  const planRows = useCloudSlice((snapshot) => snapshot.workoutPlans);
  const templateRows = useCloudSlice((snapshot) => snapshot.splitTemplates);

  const plan = useMemo(() => {
    const row = planRows.find((candidate) => candidate.profile_id === profileId);
    return row ? toWorkoutPlan(row) : null;
  }, [planRows, profileId]);

  /** The whole account's library (RLS already limits rows to this account). */
  const accountWorkoutSplits: WorkoutSplitTemplate[] = useMemo(
    () =>
      templateRows
        .map(toSplitTemplate)
        .filter((template): template is WorkoutSplitTemplate => template !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.splitName.localeCompare(b.splitName) || a.id.localeCompare(b.id)),
    [templateRows],
  );

  /** How many profiles currently use each shared split. */
  const profileCountBySplitId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of planRows) {
      const rowPlan = toWorkoutPlan(row);
      if (rowPlan?.planType === 'CUSTOM' && rowPlan.activeWorkoutSplitId) {
        counts.set(rowPlan.activeWorkoutSplitId, (counts.get(rowPlan.activeWorkoutSplitId) ?? 0) + 1);
      }
    }
    return counts;
  }, [planRows]);

  const activeWorkoutSplit: ActiveWorkoutSplit = useMemo(() => resolveActiveSplit(plan, accountWorkoutSplits), [plan, accountWorkoutSplits]);
  const activeDays: readonly WorkoutDay[] = useMemo(() => activeSplitDays(activeWorkoutSplit), [activeWorkoutSplit]);
  const activeWorkoutSplitName = activeSplitName(activeWorkoutSplit);

  const activateBuiltInPpl = useCallback(() => workoutPlanService.activatePpl(profileId, plan), [profileId, plan]);
  const activateWorkoutSplit = useCallback((template: WorkoutSplitTemplate) => workoutPlanService.activateWorkoutSplit(profileId, template), [profileId]);
  const createWorkoutSplit = useCallback(
    (splitName: string, days: readonly CustomDayPlan[]) => workoutSplitTemplateService.create(profileId, splitName, days, accountWorkoutSplits),
    [profileId, accountWorkoutSplits],
  );
  const updateWorkoutSplit = useCallback(
    (template: WorkoutSplitTemplate, splitName: string, days: readonly CustomDayPlan[]) =>
      workoutSplitTemplateService.update(template, splitName, days, accountWorkoutSplits),
    [accountWorkoutSplits],
  );
  const duplicateWorkoutSplit = useCallback(
    (sourceName: string, sourceDays: readonly CustomDayPlan[]) =>
      workoutSplitTemplateService.duplicate(profileId, sourceName, sourceDays, accountWorkoutSplits),
    [profileId, accountWorkoutSplits],
  );
  const deleteWorkoutSplit = useCallback((template: WorkoutSplitTemplate) => workoutSplitTemplateService.remove(template), []);

  return {
    plan,
    accountWorkoutSplits,
    profileCountBySplitId,
    activeWorkoutSplit,
    activeWorkoutSplitName,
    activeDays,
    activateBuiltInPpl,
    activateWorkoutSplit,
    createWorkoutSplit,
    updateWorkoutSplit,
    duplicateWorkoutSplit,
    deleteWorkoutSplit,
  };
}
