export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface Profile {
  id: string;
  name: string;
  gender: Gender;
  /** Resized, compressed avatar (~256×256) as a data URL. Absent = show initials. */
  photoDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Values the Add/Edit Profile form produces. `photoDataUrl: null` = no picture. */
export interface ProfileInput {
  name: string;
  gender: Gender;
  photoDataUrl: string | null;
}

/** Fields a user is allowed to change on an existing profile. */
export type ProfileUpdates = Partial<ProfileInput>;

export type DayId =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WorkoutCategory = 'push' | 'pull' | 'legs' | 'rest';

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
  /** 2 = start + peak poses, 1 = single pose. */
  poseCount?: 1 | 2;
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
