import { isMuscleGroupId } from '../constants/muscleGroups';
import { WEEKLY_SCHEDULE, WORKOUT_CATEGORIES } from '../constants/workoutSchedule';
import type { CustomDayPlan, DayId, MuscleGroupId, WorkoutCategory, WorkoutDay, WorkoutPlan, WorkoutPlanType } from '../types/gym';

export const SPLIT_NAME_MAX_LENGTH = 40;
export const DEFAULT_SPLIT_NAME = 'My Split';

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
    const muscleGroupIds = [...new Set(candidate.muscleGroupIds)];
    byId.set(candidate.dayId, {
      dayId: candidate.dayId,
      workoutName: candidate.workoutName.trim(),
      muscleGroupIds: candidate.isRest ? [] : muscleGroupIds,
      isRest: candidate.isRest,
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
