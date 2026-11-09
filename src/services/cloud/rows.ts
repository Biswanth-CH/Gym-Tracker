import { DEFAULT_GENDER, isGender } from '../../constants/profileOptions';
import { DEFAULT_PROFILE_THEME, isProfileThemeKey } from '../../constants/profileThemes';
import type {
  AttendanceStatus,
  BodyWeightEntry,
  DailyTrackerState,
  ExerciseSelection,
  PersonalRecord,
  Profile,
  SetPlan,
  SetTemplate,
  WeightUnit,
  WorkoutPlan,
  WorkoutSplitTemplate,
} from '../../types/gym';
import { isPlanType, parseCustomSchedule } from '../../utils/workoutPlan';

/** Database row shapes (snake_case, as stored in Supabase). */

export interface ProfileRow {
  id: string;
  owner_id: string;
  name: string;
  gender: string;
  photo_path: string | null;
  tracking_start_date: string;
  /** Phase 5 columns: absent until the Phase 5 migration runs. */
  age_years?: number | null;
  height_cm?: number | string | null;
  /** Phase 6 column: absent until the Phase 6 migration runs (then defaults to lime). */
  theme_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  profile_id: string;
  date: string;
  status: AttendanceStatus;
  updated_at: string;
}

export interface SelectionRow {
  id: string;
  profile_id: string;
  exercise_id: string;
  date: string;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  profile_id: string;
  exercise_id: string;
  set_configuration: unknown;
  updated_at: string;
}

export interface TrackerRow {
  id: string;
  profile_id: string;
  exercise_id: string;
  date: string;
  completed_sets: number[] | null;
  updated_at: string;
}

export interface RecordRow {
  id: string;
  profile_id: string;
  exercise_id: string;
  record_date: string;
  best_session: unknown;
  notes: string | null;
  updated_at: string;
}

export interface WorkoutPlanRow {
  id: string;
  profile_id: string;
  plan_type: string;
  split_name: string;
  weekly_schedule: unknown;
  /** Phase 5 column: absent until the Phase 5 migration runs. */
  active_split_template_id?: string | null;
  /** Phase 6 column: the active (or remembered) shared split of this profile. */
  active_account_split_id?: string | null;
  updated_at: string;
}

/** Phase 6 account-wide shared split (`account_workout_split_templates`). */
export interface SplitTemplateRow {
  id: string;
  owner_id: string;
  source_profile_id: string | null;
  split_name: string;
  weekly_schedule: unknown;
  created_at: string;
  updated_at: string;
}

export interface BodyWeightRow {
  id: string;
  profile_id: string;
  recorded_date: string;
  weight_kg: number | string;
  updated_at: string;
}

export type CloudTable =
  | 'gym_profiles'
  | 'attendance_records'
  | 'daily_exercise_selections'
  | 'exercise_set_templates'
  | 'daily_set_tracker_states'
  | 'exercise_personal_records'
  | 'profile_workout_plans'
  | 'body_weight_entries'
  | 'account_workout_split_templates';

export const CLOUD_TABLES: readonly CloudTable[] = [
  'gym_profiles',
  'attendance_records',
  'daily_exercise_selections',
  'exercise_set_templates',
  'daily_set_tracker_states',
  'exercise_personal_records',
  'profile_workout_plans',
  'body_weight_entries',
  'account_workout_split_templates',
];

/* ---------- JSON column parsing (defensive: rows are external data) ---------- */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUnit = (value: unknown): value is WeightUnit => value === 'KG' || value === 'LB';
const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function parseSetPlan(value: unknown): SetPlan | null {
  if (!isObject(value) || !Array.isArray(value.sets)) return null;
  const sets = value.sets
    .filter(isObject)
    .map((set) => ({ weight: finiteOrNull(set.weight), reps: Math.max(0, Math.round(finiteOrNull(set.reps) ?? 0)) }))
    .slice(0, 30);
  return { unit: isUnit(value.unit) ? value.unit : 'KG', sets };
}

export interface BestSession {
  weight: number | null;
  unit: WeightUnit;
  reps: number;
  sets: number | null;
}

export function parseBestSession(value: unknown): BestSession | null {
  if (!isObject(value)) return null;
  const reps = finiteOrNull(value.reps);
  if (reps === null) return null;
  const sets = finiteOrNull(value.sets);
  return {
    weight: finiteOrNull(value.weight),
    unit: isUnit(value.unit) ? value.unit : 'KG',
    reps: Math.round(reps),
    sets: sets === null ? null : Math.round(sets),
  };
}

/* ---------- Row → domain mappers ---------- */

/** numeric columns arrive as strings from PostgREST; missing columns are undefined. */
function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toProfile(row: ProfileRow, photoUrl: string | null): Profile {
  return {
    id: row.id,
    name: row.name,
    gender: isGender(row.gender) ? row.gender : DEFAULT_GENDER,
    trackingStartDate: row.tracking_start_date,
    photoPath: row.photo_path,
    photoUrl,
    ageYears: toOptionalNumber(row.age_years),
    heightCm: toOptionalNumber(row.height_cm),
    themeKey: isProfileThemeKey(row.theme_key) ? row.theme_key : DEFAULT_PROFILE_THEME,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSelection(row: SelectionRow): ExerciseSelection {
  return { id: row.id, profileId: row.profile_id, exerciseId: row.exercise_id, date: row.date };
}

export function toTemplate(row: TemplateRow): SetTemplate | null {
  const plan = parseSetPlan(row.set_configuration);
  return plan ? { id: row.id, profileId: row.profile_id, exerciseId: row.exercise_id, plan, updatedAt: row.updated_at } : null;
}

export function toTrackerState(row: TrackerRow): DailyTrackerState {
  return {
    id: row.id,
    profileId: row.profile_id,
    exerciseId: row.exercise_id,
    date: row.date,
    completedSets: (row.completed_sets ?? []).filter((n) => Number.isInteger(n) && n >= 0),
    updatedAt: row.updated_at,
  };
}

export function toWorkoutPlan(row: WorkoutPlanRow): WorkoutPlan | null {
  if (!isPlanType(row.plan_type)) return null;
  const days = parseCustomSchedule(row.weekly_schedule);
  if (!days) return null;
  const splitName = row.split_name.trim();
  if (!splitName) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    planType: row.plan_type,
    splitName,
    days,
    activeWorkoutSplitId: row.active_account_split_id ?? null,
    updatedAt: row.updated_at,
  };
}

export function toSplitTemplate(row: SplitTemplateRow): WorkoutSplitTemplate | null {
  const days = parseCustomSchedule(row.weekly_schedule);
  const splitName = row.split_name.trim();
  if (!days || !splitName) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceProfileId: row.source_profile_id ?? null,
    splitName,
    days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBodyWeight(row: BodyWeightRow): BodyWeightEntry | null {
  const weightKg = typeof row.weight_kg === 'number' ? row.weight_kg : Number(row.weight_kg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  return { id: row.id, profileId: row.profile_id, date: row.recorded_date, weightKg, updatedAt: row.updated_at };
}

export function toPersonalRecord(row: RecordRow): PersonalRecord | null {
  const best = parseBestSession(row.best_session);
  if (!best) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    exerciseId: row.exercise_id,
    recordDate: row.record_date,
    weight: best.weight,
    unit: best.unit,
    reps: best.reps,
    sets: best.sets,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}
