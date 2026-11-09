import { isMuscleGroupId } from '../constants/muscleGroups';
import { WEEKLY_SCHEDULE, WORKOUT_CATEGORIES } from '../constants/workoutSchedule';
import { normalizeDaySelections, parseMuscleGroupSelections } from './workoutSelection';
import type {
  ActiveWorkoutSplit,
  CustomDayPlan,
  DayId,
  MuscleGroupId,
  WorkoutCategory,
  WorkoutDay,
  WorkoutPlan,
  WorkoutPlanType,
  WorkoutSplitTemplate,
} from '../types/gym';

export const SPLIT_NAME_MAX_LENGTH = 40;
export const DEFAULT_SPLIT_NAME = 'My Split';
/** Display name of the built-in plan (never stored as a template, never deletable). */
export const BUILT_IN_PPL_NAME = 'PPL';

const PUSH = new Set<MuscleGroupId>(['chest', 'shoulders', 'triceps']);
const PULL = new Set<MuscleGroupId>(['back', 'biceps', 'forearms']);
const LEGS = new Set<MuscleGroupId>(['legs', 'abs']);

const DAY_META = new Map(WEEKLY_SCHEDULE.map((day) => [day.id, day]));

export function defaultCustomSchedule(): CustomDayPlan[] {
  return WEEKLY_SCHEDULE.map((day) => ({
    dayId: day.id,
    workoutName: day.category === 'rest' ? 'Rest' : WORKOUT_CATEGORIES[day.category].label,
    muscleGroupIds: [...day.muscleGroupIds],
    isRest: day.category === 'rest',
  }));
}

export function inferWorkoutCategory(day: Pick<CustomDayPlan, 'isRest' | 'muscleGroupIds'>): WorkoutCategory {
  if (day.isRest || day.muscleGroupIds.length === 0) return 'rest';
  if (day.muscleGroupIds.every((id) => PUSH.has(id))) return 'push';
  if (day.muscleGroupIds.every((id) => PULL.has(id))) return 'pull';
  if (day.muscleGroupIds.every((id) => LEGS.has(id))) return 'legs';
  return 'mixed';
}

export function customDayToWorkoutDay(day: CustomDayPlan): WorkoutDay | null {
  const meta = DAY_META.get(day.dayId);
  if (!meta) return null;
  const category = inferWorkoutCategory(day);
  return {
    id: day.dayId,
    dayName: meta.dayName,
    shortName: meta.shortName,
    category,
    muscleGroupIds: day.isRest ? [] : [...day.muscleGroupIds],
    title: day.workoutName.trim() || (category === 'rest' ? 'Rest' : meta.dayName),
    ...(day.isRest || !day.muscleGroupSelections ? {} : { muscleGroupSelections: day.muscleGroupSelections }),
  };
}

/** PPL uses the built-in schedule. Custom uses the saved seven days. */
export function resolveActiveSchedule(plan: Pick<WorkoutPlan, 'planType' | 'days'> | null): readonly WorkoutDay[] {
  if (!plan || plan.planType === 'PPL') return WEEKLY_SCHEDULE;
  const resolved = plan.days.map(customDayToWorkoutDay);
  if (resolved.some((day) => day === null) || resolved.length !== WEEKLY_SCHEDULE.length) return WEEKLY_SCHEDULE;
  return resolved as WorkoutDay[];
}

export function isPlanType(value: unknown): value is WorkoutPlanType {
  return value === 'PPL' || value === 'CUSTOM';
}

function isDayId(value: unknown): value is DayId {
  return typeof value === 'string' && DAY_META.has(value as DayId);
}

/** Parses the jsonb `weekly_schedule` column. Returns null when the shape is unusable. */
export function parseCustomSchedule(value: unknown): CustomDayPlan[] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const days = (value as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  const byId = new Map<DayId, CustomDayPlan>();
  for (const entry of days) {
    if (typeof entry !== 'object' || entry === null) return null;
    const candidate = entry as Record<string, unknown>;
    if (!isDayId(candidate.dayId) || byId.has(candidate.dayId)) return null;
    if (typeof candidate.workoutName !== 'string') return null;
    if (typeof candidate.isRest !== 'boolean') return null;
    if (!Array.isArray(candidate.muscleGroupIds) || !candidate.muscleGroupIds.every(isMuscleGroupId)) return null;
    const muscleGroupIds = candidate.isRest ? [] : [...new Set(candidate.muscleGroupIds)];
    // Phase 6 nested selections are optional: missing → ALL regions and ALL exercises.
    const muscleGroupSelections = candidate.isRest ? undefined : parseMuscleGroupSelections(candidate.muscleGroupSelections, muscleGroupIds);
    byId.set(candidate.dayId, {
      dayId: candidate.dayId,
      workoutName: candidate.workoutName.trim(),
      muscleGroupIds,
      isRest: candidate.isRest,
      ...(muscleGroupSelections ? { muscleGroupSelections } : {}),
    });
  }
  if (byId.size !== WEEKLY_SCHEDULE.length) return null;
  return WEEKLY_SCHEDULE.map((day) => byId.get(day.id)!);
}

export function validateCustomSchedule(splitName: string, days: readonly CustomDayPlan[]): string | null {
  const name = splitName.trim();
  if (name.length === 0) return 'Enter a name for this split.';
  if (name.length > SPLIT_NAME_MAX_LENGTH) return `Split name can be at most ${SPLIT_NAME_MAX_LENGTH} characters.`;
  if (days.length !== WEEKLY_SCHEDULE.length) return 'The split needs all seven days.';
  for (const expected of WEEKLY_SCHEDULE) {
    const day = days.find((candidate) => candidate.dayId === expected.id);
    if (!day) return `Missing ${expected.dayName}.`;
    if (day.isRest) continue;
    if (day.workoutName.trim().length === 0) return `${expected.dayName} needs a workout name.`;
    if (day.workoutName.trim().length > SPLIT_NAME_MAX_LENGTH) return `${expected.dayName}'s workout name is too long.`;
    if (day.muscleGroupIds.length === 0) return `${expected.dayName} needs at least one muscle group, or mark it as rest.`;
    if (!day.muscleGroupIds.every(isMuscleGroupId)) return `${expected.dayName} has an unknown muscle group.`;
  }
  return null;
}

/* ---------- Phase 5: many saved splits per profile ---------- */

/**
 * Which split the weekly plan shows.
 *  - no plan row, or plan_type PPL        → built-in PPL
 *  - CUSTOM + an existing active template → that saved split
 *  - CUSTOM without a usable template     → the legacy single custom schedule (kept for
 *    projects where the Phase 5 SQL has not run yet, or while Realtime catches up)
 */
export function resolveActiveSplit(
  plan: Pick<WorkoutPlan, 'planType' | 'splitName' | 'days' | 'activeWorkoutSplitId'> | null,
  templates: readonly WorkoutSplitTemplate[],
): ActiveWorkoutSplit {
  if (!plan || plan.planType === 'PPL') return { kind: 'PPL' };
  const template = plan.activeWorkoutSplitId ? templates.find((candidate) => candidate.id === plan.activeWorkoutSplitId) : undefined;
  if (template) return { kind: 'CUSTOM', template };
  return { kind: 'LEGACY_CUSTOM', splitName: plan.splitName, days: plan.days };
}

/** The seven days to render for the active split. */
export function activeSplitDays(active: ActiveWorkoutSplit): readonly WorkoutDay[] {
  if (active.kind === 'PPL') return WEEKLY_SCHEDULE;
  const days = active.kind === 'CUSTOM' ? active.template.days : active.days;
  return resolveActiveSchedule({ planType: 'CUSTOM', days });
}

export function activeSplitName(active: ActiveWorkoutSplit): string {
  if (active.kind === 'PPL') return BUILT_IN_PPL_NAME;
  return active.kind === 'CUSTOM' ? active.template.splitName : active.splitName;
}

export function countTrainingDays(days: readonly Pick<CustomDayPlan, 'isRest' | 'muscleGroupIds'>[]): number {
  return days.filter((day) => !day.isRest && day.muscleGroupIds.length > 0).length;
}

const splitNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Case-insensitive duplicate check within one profile (the database enforces the same rule). */
export function isSplitNameTaken(name: string, templates: readonly Pick<WorkoutSplitTemplate, 'id' | 'splitName'>[], excludeId?: string): boolean {
  const key = splitNameKey(name);
  return key === splitNameKey(BUILT_IN_PPL_NAME) || templates.some((template) => template.id !== excludeId && splitNameKey(template.splitName) === key);
}

/** "Upper Lower (copy)", then "(copy 2)", … — always within the length limit. */
export function duplicateSplitName(sourceName: string, templates: readonly Pick<WorkoutSplitTemplate, 'id' | 'splitName'>[]): string {
  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const suffix = attempt === 1 ? ' (copy)' : ` (copy ${attempt})`;
    const base = sourceName.trim().slice(0, SPLIT_NAME_MAX_LENGTH - suffix.length).trimEnd();
    const candidate = `${base}${suffix}`;
    if (!isSplitNameTaken(candidate, templates)) return candidate;
  }
  return sourceName.trim().slice(0, SPLIT_NAME_MAX_LENGTH);
}

/** Deep copy so edits to a draft never mutate a stored template. */
export function cloneSchedule(days: readonly CustomDayPlan[]): CustomDayPlan[] {
  return days.map((day) => ({
    ...day,
    muscleGroupIds: [...day.muscleGroupIds],
    ...(day.muscleGroupSelections
      ? {
          muscleGroupSelections: day.muscleGroupSelections.map((selection) => ({
            ...selection,
            regions: selection.regions.map((region) => ({ ...region, exerciseIds: [...region.exerciseIds] })),
          })),
        }
      : {}),
  }));
}

/** Normalises a draft before saving: rest days carry no muscles and get a default label. */
export function normalizeSchedule(days: readonly CustomDayPlan[]): CustomDayPlan[] {
  return days.map((day) =>
    normalizeDaySelections({
      ...day,
      workoutName: day.isRest ? day.workoutName.trim() || 'Rest' : day.workoutName.trim(),
      muscleGroupIds: day.isRest ? [] : [...new Set(day.muscleGroupIds)],
    }),
  );
}
