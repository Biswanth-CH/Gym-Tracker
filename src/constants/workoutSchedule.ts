import type { CategoryMeta, DayId, WorkoutCategory, WorkoutDay } from '../types/gym';

export const WORKOUT_CATEGORIES: Record<WorkoutCategory, CategoryMeta> = {
  push: {
    label: 'Push Day',
    tagline: 'Press, extend, overload.',
    description:
      'Pressing movements that train the muscles you use to push weight away from your body.',
  },
  pull: {
    label: 'Pull Day',
    tagline: 'Row, curl, build a strong back.',
    description:
      'Pulling movements that train the muscles you use to draw weight toward your body.',
  },
  legs: {
    label: 'Leg Day',
    tagline: 'Never skip it.',
    description:
      'Lower-body work for strength, stability and power: quads, hamstrings, glutes and calves.',
  },
  rest: {
    label: 'Rest Day',
    tagline: 'Recover to grow stronger.',
    description:
      'Muscles grow while you rest. Sleep well, hydrate, stretch and keep any movement light.',
  },
};

export const WORKOUT_CATEGORY_ORDER: readonly WorkoutCategory[] = ['push', 'pull', 'legs', 'rest'];

export const WEEKLY_SCHEDULE: readonly WorkoutDay[] = [
  { id: 'monday', dayName: 'Monday', shortName: 'Mon', category: 'push', muscleGroups: ['Chest', 'Triceps'] },
  { id: 'tuesday', dayName: 'Tuesday', shortName: 'Tue', category: 'pull', muscleGroups: ['Biceps', 'Back'] },
  { id: 'wednesday', dayName: 'Wednesday', shortName: 'Wed', category: 'legs', muscleGroups: ['Legs'] },
  { id: 'thursday', dayName: 'Thursday', shortName: 'Thu', category: 'push', muscleGroups: ['Chest', 'Triceps'] },
  { id: 'friday', dayName: 'Friday', shortName: 'Fri', category: 'pull', muscleGroups: ['Biceps', 'Back'] },
  { id: 'saturday', dayName: 'Saturday', shortName: 'Sat', category: 'legs', muscleGroups: ['Legs'] },
  { id: 'sunday', dayName: 'Sunday', shortName: 'Sun', category: 'rest', muscleGroups: ['Rest & Recovery'] },
];

const DAY_IDS = new Set<string>(WEEKLY_SCHEDULE.map((day) => day.id));

export function isDayId(value: string): value is DayId {
  return DAY_IDS.has(value);
}

export function getWorkoutDay(dayId: DayId): WorkoutDay | undefined {
  return WEEKLY_SCHEDULE.find((day) => day.id === dayId);
}

/** JS Date#getDay(): 0 = Sunday … 6 = Saturday. */
const JS_DAY_TO_ID: readonly DayId[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function getTodayDayId(date: Date = new Date()): DayId {
  return JS_DAY_TO_ID[date.getDay()];
}
