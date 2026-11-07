import { useCallback, useMemo } from 'react';
import { toSplitTemplate, toWorkoutPlan } from '../services/cloud/rows';
import { workoutPlanService, workoutSplitTemplateService } from '../services/cloud/workoutPlanService';
import type { ActiveWorkoutSplit, CustomDayPlan, WorkoutDay, WorkoutSplitTemplate } from '../types/gym';
import { activeSplitDays, activeSplitName, resolveActiveSplit } from '../utils/workoutPlan';
import { useCloudSlice } from './useCloud';

/**
 * The active weekly plan and every saved custom split of one profile.
 * Missing cloud rows mean the built-in PPL split. Each profile has its own collection.
 */
export function useWorkoutPlan(profileId: string) {
  const planRows = useCloudSlice((snapshot) => snapshot.workoutPlans);
  const templateRows = useCloudSlice((snapshot) => snapshot.splitTemplates);

  const plan = useMemo(() => {
    const row = planRows.find((candidate) => candidate.profile_id === profileId);
    return row ? toWorkoutPlan(row) : null;
  }, [planRows, profileId]);

  const splitTemplates: WorkoutSplitTemplate[] = useMemo(
    () =>
      templateRows
        .filter((row) => row.profile_id === profileId)
        .map(toSplitTemplate)
        .filter((template): template is WorkoutSplitTemplate => template !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.splitName.localeCompare(b.splitName)),
    [templateRows, profileId],
  );

  const activeWorkoutSplit: ActiveWorkoutSplit = useMemo(() => resolveActiveSplit(plan, splitTemplates), [plan, splitTemplates]);
  const activeDays: readonly WorkoutDay[] = useMemo(() => activeSplitDays(activeWorkoutSplit), [activeWorkoutSplit]);
  const activeWorkoutSplitName = activeSplitName(activeWorkoutSplit);

  const activateBuiltInPpl = useCallback(() => workoutPlanService.activatePpl(profileId, plan), [profileId, plan]);
  const activateWorkoutSplit = useCallback((template: WorkoutSplitTemplate) => workoutPlanService.activateTemplate(template), []);

  const createWorkoutSplit = useCallback(
    async (splitName: string, days: readonly CustomDayPlan[]) =>
      workoutSplitTemplateService.create(profileId, splitName, days, splitTemplates),
    [profileId, splitTemplates],
  );
  const updateWorkoutSplit = useCallback(
    (template: WorkoutSplitTemplate, splitName: string, days: readonly CustomDayPlan[]) =>
      workoutSplitTemplateService.update(template, splitName, days, splitTemplates, plan),
    [splitTemplates, plan],
  );
  const duplicateWorkoutSplit = useCallback(
    (sourceName: string, sourceDays: readonly CustomDayPlan[]) =>
      workoutSplitTemplateService.duplicate(profileId, sourceName, sourceDays, splitTemplates),
    [profileId, splitTemplates],
  );
  const deleteWorkoutSplit = useCallback((template: WorkoutSplitTemplate) => workoutSplitTemplateService.remove(template, plan), [plan]);

  return {
    plan,
    splitTemplates,
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
