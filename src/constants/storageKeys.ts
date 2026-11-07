/** Last profile opened in this browser tab, so the bottom nav can return to it. */
export const LAST_PROFILE_KEY = 'gymtrack-last-profile-id';

export const STORAGE_KEYS = {
  profiles: 'gym-tracker-profiles',
  attendance: 'gym-tracker-attendance',
  workoutLogs: 'gym-tracker-workout-logs',
  exercisePreferences: 'gym-tracker-exercise-preferences',
} as const;

export const PROFILE_NAME_MAX_LENGTH = 30;
