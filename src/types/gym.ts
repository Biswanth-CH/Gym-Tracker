export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/** A GymTrack profile stored in Supabase (`gym_profiles`), owned by the signed-in account. */
export interface Profile {
  id: string;
  name: string;
  gender: Gender;
  /** Local calendar date attendance tracking starts from. */
  trackingStartDate: DateKey;
  /** Object path in the private `gym-profile-photos` bucket, or null. */
  photoPath: string | null;
  /** Short-lived signed URL for `photoPath` (resolved by the cloud store). */
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What happens to the profile photo when the form is saved. */
export type PhotoChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; dataUrl: string };

/** Values the Add/Edit Profile form produces. */
export interface ProfileInput {
  name: string;
  gender: Gender;
  trackingStartDate: DateKey;
  photo: PhotoChange;
}

/**
 * Profile shape from the original LocalStorage version (Phases 1–2).
 * Only read for the one-time cloud migration — never written by the cloud app.
 */
export interface LocalProfile {
  id: string;
  name: string;
  gender: Gender;
  /** Resized, compressed avatar (~256×256) as a data URL. */
  photoDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Local-version inputs, kept for the legacy services used by migration tests. */
export interface LocalProfileInput {
  name: string;
  gender: Gender;
  photoDataUrl: string | null;
}
export type ProfileUpdates = Partial<LocalProfileInput>;

export type DayId =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WorkoutCategory = 'push' | 'pull' | 'legs' | 'rest' | 'mixed';

export interface CategoryMeta {
  label: string;
  tagline: string;
  description: string;
}

export interface WorkoutDay {
  id: DayId;
  dayName: string;
  shortName: string;
  category: WorkoutCategory;
  /** Trained muscle groups (empty on rest days). */
  muscleGroupIds: MuscleGroupId[];
  /** Custom split label. When omitted, the category label is shown. */
  title?: string;
}

export type WorkoutPlanType = 'PPL' | 'CUSTOM';

/** One day inside a profile's saved custom split. */
export interface CustomDayPlan {
  dayId: DayId;
  workoutName: string;
  muscleGroupIds: MuscleGroupId[];
  isRest: boolean;
}

/** Saved plan for one profile (`profile_workout_plans`). PPL display ignores `days`. */
export interface WorkoutPlan {
  id: string;
  profileId: string;
  planType: WorkoutPlanType;
  splitName: string;
  days: CustomDayPlan[];
  updatedAt: string;
}

/** One daily weigh-in (`body_weight_entries`). `weightKg` is the canonical stored value. */
export interface BodyWeightEntry {
  id: string;
  profileId: string;
  date: DateKey;
  weightKg: number;
  updatedAt: string;
}

/* ---------- Muscle hierarchy ---------- */

export type MuscleGroupId =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'back'
  | 'forearms'
  | 'legs'
  | 'abs';

export type AnatomyView = 'front' | 'back';

export interface MuscleRegion {
  id: string;
  muscleGroupId: MuscleGroupId;
  name: string;
  /** Anatomical name(s) shown under the friendly name. */
  anatomicalName: string;
  description: string;
}

export interface MuscleGroup {
  id: MuscleGroupId;
  name: string;
  description: string;
  /** Explains overlap between regions / heads. */
  emphasisNote: string;
  regions: MuscleRegion[];
}

/* ---------- Equipment & exercise library ---------- */

export type EquipmentKind = 'MACHINE' | 'CABLE' | 'BENCH' | 'FREE_WEIGHT' | 'BAND' | 'BODYWEIGHT' | 'CARDIO';

export interface Equipment {
  id: string;
  name: string;
  kind: EquipmentKind;
  /** What this (possibly combined) piece of equipment is used for. */
  supports: string[];
  /** Whether exercises using it may appear in the Alternatives section. */
  allowedInAlternatives: boolean;
  note?: string;
}

export type ExerciseCategory = 'MACHINE' | 'ALTERNATIVE';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/**
 * How the "weight" field of a set is interpreted:
 * - WEIGHTED: load lifted (higher is better).
 * - BODYWEIGHT: optional added load on top of bodyweight.
 * - ASSISTED: machine assistance (lower is harder / better).
 * - BAND: resistance band, no numeric load.
 */
export type LoadType = 'WEIGHTED' | 'BODYWEIGHT' | 'ASSISTED' | 'BAND';

/** What the second number of a set measures. */
export type SetMeasure = 'REPS' | 'SECONDS';

export interface ExerciseTarget {
  muscleGroupId: MuscleGroupId;
  regionId: string;
}

export interface ExerciseMedia {
  /** RepDB free-tier exercise id; images are resolved from it. */
  repdbId?: string;
  /** Original GymTrack SVG illustration id (public/exercise-images/custom/<id>-start|peak|main.svg). */
  customId?: string;
  /** 2 = start + peak poses, 1 = single pose. */
  poseCount?: 1 | 2;
  /** Label for a single-pose image (default "Position"). */
  mainLabel?: string;
  /** Extra single-pose RepDB images shown as alternatives (e.g. cycle vs treadmill). */
  alternates?: Array<{ repdbId: string; label: string }>;
  /** Set when the illustration is a close variant rather than the exact exercise. */
  imageNote?: string;
  /** Optional licensed animation (GIF/WebP/MP4). None bundled yet. */
  animationUrl?: string;
  animationCredit?: string;
}

export interface LibraryExercise {
  id: string;
  name: string;
  /** Every region list this exercise appears in; the first is its main listing. */
  targets: ExerciseTarget[];
  category: ExerciseCategory;
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  commonMistakes: string[];
  difficulty: Difficulty;
  recommendedSets: number;
  recommendedRepRange: { min: number; max: number };
  loadType: LoadType;
  measure: SetMeasure;
  setupNote?: string;
  media: ExerciseMedia;
}

/* ---------- Stretching ---------- */

export type StretchPhase = 'WARMUP' | 'COOLDOWN';
/** DYNAMIC = moving warm-up, STATIC = held cooldown stretch, CARDIO = light pulse raiser. */
export type StretchStyle = 'DYNAMIC' | 'STATIC' | 'CARDIO';

export interface Stretch {
  id: string;
  name: string;
  phase: StretchPhase;
  style: StretchStyle;
  /** Plain-language target muscles. */
  target: string;
  instructions: string[];
  /** Suggested duration or repetitions. */
  dose: string;
  media: ExerciseMedia;
  optional?: boolean;
}

/* ---------- Workout logging ---------- */

export type WeightUnit = 'KG' | 'LB';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  /** Load in `weightUnit`; null when not entered (or not applicable, e.g. bands). */
  weight: number | null;
  weightUnit: WeightUnit;
  /** Repetitions, or seconds for timed exercises. Null when not entered. */
  repetitions: number | null;
  completed: boolean;
}

/** One exercise on one date for one profile (unique per profile + exercise + date). */
export interface WorkoutExerciseLog {
  id: string;
  profileId: string;
  exerciseId: string;
  date: DateKey;
  sets: WorkoutSet[];
  createdAt: string;
  updatedAt: string;
}

export interface ExercisePreference {
  /** Stored exactly as entered, in `workingWeightUnit` — never converted in place. */
  workingWeight: number | null;
  workingWeightUnit: WeightUnit;
  /** Unit the user prefers to log and view this exercise in. */
  weightUnit: WeightUnit;
  updatedAt: string | null;
}

/* ---------- Phase 3: cloud-backed set plans, daily tracker, PRs, selections ---------- */

export interface PlannedSet {
  /** Load in the plan's unit; null until entered (or for bands / bodyweight). */
  weight: number | null;
  /** Repetitions, or seconds for timed exercises. */
  reps: number;
}

/** Reusable set configuration per profile + exercise (`exercise_set_templates`). */
export interface SetPlan {
  unit: WeightUnit;
  sets: PlannedSet[];
}

export interface SetTemplate {
  id: string;
  profileId: string;
  exerciseId: string;
  plan: SetPlan;
  updatedAt: string;
}

/** Which planned sets were ticked on one local date (`daily_set_tracker_states`). */
export interface DailyTrackerState {
  id: string;
  profileId: string;
  exerciseId: string;
  date: DateKey;
  /** Zero-based indexes of completed sets. */
  completedSets: number[];
  updatedAt: string;
}

/** Manually managed best result per profile + exercise (`exercise_personal_records`). */
export interface PersonalRecord {
  id: string;
  profileId: string;
  exerciseId: string;
  recordDate: DateKey;
  weight: number | null;
  unit: WeightUnit;
  reps: number;
  sets: number | null;
  notes: string | null;
  updatedAt: string;
}

export type PersonalRecordInput = Omit<PersonalRecord, 'id' | 'profileId' | 'exerciseId' | 'updatedAt'>;

/** An exercise variation chosen for a date (`daily_exercise_selections`). */
export interface ExerciseSelection {
  id: string;
  profileId: string;
  exerciseId: string;
  date: DateKey;
}

export type ExercisePreferenceChanges = Partial<Pick<ExercisePreference, 'workingWeight' | 'workingWeightUnit' | 'weightUnit'>>;

/* ---------- Attendance ---------- */

export type AttendanceStatus = 'ATTENDED' | 'MISSED';

/** Local calendar date in `YYYY-MM-DD` form (never a UTC timestamp). */
export type DateKey = string;

export interface AttendanceRecord {
  profileId: string;
  date: DateKey;
  status: AttendanceStatus;
  updatedAt: string;
}

/** Fast lookup of one profile's attendance: date → status. Unmarked dates are absent. */
export type AttendanceMap = ReadonlyMap<DateKey, AttendanceStatus>;

export type Route =
  | { name: 'profiles' }
  | { name: 'dashboard'; profileId: string }
  | { name: 'day'; profileId: string; dayId: DayId }
  | { name: 'consistency'; profileId: string }
  | { name: 'muscle'; profileId: string; dayId: DayId; muscleId: string }
  | {
      name: 'region';
      profileId: string;
      dayId: DayId;
      muscleId: string;
      regionId: string;
      category: ExerciseCategory;
    }
  | {
      name: 'exercise';
      profileId: string;
      dayId: DayId;
      muscleId: string;
      regionId: string;
      exerciseId: string;
    };
