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

/**
 * Planned for a future version (exercise tracking). Defined now so the
 * day structure is ready to receive exercises without reshaping.
 */
export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
  completed: boolean;
  notes?: string;
}

export interface WorkoutDay {
  id: DayId;
  dayName: string;
  shortName: string;
  category: WorkoutCategory;
  muscleGroups: string[];
  exercises?: Exercise[];
}

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
  | { name: 'consistency'; profileId: string };
