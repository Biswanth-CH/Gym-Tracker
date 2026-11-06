export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields a user is allowed to change on an existing profile. */
export type ProfileUpdates = Partial<Pick<Profile, 'name'>>;

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

export type Route =
  | { name: 'profiles' }
  | { name: 'dashboard'; profileId: string }
  | { name: 'day'; profileId: string; dayId: DayId };
