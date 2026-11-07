import { getSupabase } from '../../lib/supabaseClient';
import { cloudStore } from '../../store/cloudStore';
import type { AttendanceStatus, DateKey, PersonalRecordInput, SetPlan } from '../../types/gym';
import { isSunday, isValidDateKey, parseDateKey, toDateKey } from '../../utils/dateUtils';
import { MAX_REPS, MAX_SECONDS, MAX_SETS_PER_SESSION, MAX_WEIGHT } from '../../utils/workoutUtils';
import { CloudError, ensureOk } from './cloudErrors';
import { upsertRow } from './db';
import type { AttendanceRow, RecordRow, SelectionRow, TemplateRow, TrackerRow } from './rows';

/*
 * attendanceService · exerciseSelectionService · setTemplateService ·
 * dailySetTrackerService · personalRecordService
 *
 * Every write is an upsert on the table's natural unique key, so retries and
 * double-taps never create duplicates. Successful results are applied to the
 * cloud store immediately; Realtime then updates other devices.
 */

const today = () => toDateKey(new Date());

function assertPastOrToday(date: DateKey, what: string): void {
  if (!isValidDateKey(date)) throw new CloudError('That is not a valid date.', 'validation');
  if (date > today()) throw new CloudError(`${what} can’t be set for a future date.`, 'validation');
}

/* ---------------- attendanceService ---------------- */

export const attendanceService = {
  async setStatus(profileId: string, date: DateKey, status: AttendanceStatus): Promise<void> {
    assertPastOrToday(date, 'Attendance');
    if (isSunday(parseDateKey(date))) throw new CloudError('Sundays are rest days and can’t be marked.', 'validation');
    const row = await upsertRow<AttendanceRow>('attendance_records', { profile_id: profileId, date, status }, 'profile_id,date', 'Could not save attendance.');
    cloudStore.applyUpserts('attendance_records', [row]);
  },

  async clear(profileId: string, date: DateKey): Promise<void> {
    ensureOk(await getSupabase().from('attendance_records').delete().eq('profile_id', profileId).eq('date', date), 'Could not clear attendance.');
    cloudStore.applyDeletes('attendance_records', (row) => row.profile_id === profileId && row.date === date);
  },
};

/* ---------------- exerciseSelectionService ---------------- */

export const exerciseSelectionService = {
  async select(profileId: string, exerciseId: string, date: DateKey): Promise<void> {
    assertPastOrToday(date, 'An exercise selection');
    const row = await upsertRow<SelectionRow>(
      'daily_exercise_selections',
      { profile_id: profileId, exercise_id: exerciseId, date },
      'profile_id,exercise_id,date',
      'Could not add this variation to today’s workout.',
    );
    cloudStore.applyUpserts('daily_exercise_selections', [row]);
  },

  /** Removes one variation from one date only — other dates are never touched. */
  async deselect(profileId: string, exerciseId: string, date: DateKey): Promise<void> {
    ensureOk(
      await getSupabase().from('daily_exercise_selections').delete().eq('profile_id', profileId).eq('exercise_id', exerciseId).eq('date', date),
      'Could not remove this variation from today’s workout.',
    );
    cloudStore.applyDeletes('daily_exercise_selections', (row) => row.profile_id === profileId && row.exercise_id === exerciseId && row.date === date);
  },
};

/* ---------------- setTemplateService ---------------- */

export function validateSetPlan(plan: SetPlan, measure: 'REPS' | 'SECONDS'): string | null {
  if (plan.sets.length === 0) return 'Add at least one set.';
  if (plan.sets.length > MAX_SETS_PER_SESSION) return `A plan can have at most ${MAX_SETS_PER_SESSION} sets.`;
  const maxAmount = measure === 'SECONDS' ? MAX_SECONDS : MAX_REPS;
  for (const [index, set] of plan.sets.entries()) {
    if (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > MAX_WEIGHT)) {
      return `Set ${index + 1}: weight must be between 0 and ${MAX_WEIGHT}.`;
    }
    if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > maxAmount) {
      return `Set ${index + 1}: ${measure === 'SECONDS' ? 'seconds' : 'reps'} must be a whole number between 1 and ${maxAmount}.`;
    }
  }
  return null;
}

export const setTemplateService = {
  async save(profileId: string, exerciseId: string, plan: SetPlan, measure: 'REPS' | 'SECONDS'): Promise<void> {
    const problem = validateSetPlan(plan, measure);
    if (problem) throw new CloudError(problem, 'validation');
    const row = await upsertRow<TemplateRow>(
      'exercise_set_templates',
      { profile_id: profileId, exercise_id: exerciseId, set_configuration: plan },
      'profile_id,exercise_id',
      'Could not save the set plan.',
    );
    cloudStore.applyUpserts('exercise_set_templates', [row]);
  },
};

/* ---------------- dailySetTrackerService ---------------- */

export const dailySetTrackerService = {
  /** Saves which sets are ticked for one local date. Not a workout history record. */
  async setCompleted(profileId: string, exerciseId: string, date: DateKey, completed: number[]): Promise<void> {
    assertPastOrToday(date, 'Set progress');
    const clean = [...new Set(completed.filter((n) => Number.isInteger(n) && n >= 0 && n < MAX_SETS_PER_SESSION))].sort((a, b) => a - b);
    const row = await upsertRow<TrackerRow>(
      'daily_set_tracker_states',
      { profile_id: profileId, exercise_id: exerciseId, date, completed_sets: clean },
      'profile_id,exercise_id,date',
      'Could not save your set progress.',
    );
    cloudStore.applyUpserts('daily_set_tracker_states', [row]);
  },
};

/* ---------------- personalRecordService ---------------- */

export function validatePersonalRecord(input: PersonalRecordInput, measure: 'REPS' | 'SECONDS', needsWeight: boolean): string | null {
  if (!isValidDateKey(input.recordDate)) return 'Please choose the date you achieved it.';
  if (input.recordDate > today()) return 'The PR date can’t be in the future.';
  if (needsWeight && input.weight === null) return 'Please enter the weight.';
  if (input.weight !== null && (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > MAX_WEIGHT)) return `Weight must be between 0 and ${MAX_WEIGHT}.`;
  const maxAmount = measure === 'SECONDS' ? MAX_SECONDS : MAX_REPS;
  if (!Number.isInteger(input.reps) || input.reps < 1 || input.reps > maxAmount) {
    return `${measure === 'SECONDS' ? 'Seconds' : 'Reps'} must be a whole number between 1 and ${maxAmount}.`;
  }
  if (input.sets !== null && (!Number.isInteger(input.sets) || input.sets < 1 || input.sets > MAX_SETS_PER_SESSION)) {
    return `Sets must be a whole number between 1 and ${MAX_SETS_PER_SESSION}.`;
  }
  if (input.notes !== null && input.notes.length > 500) return 'Notes can be at most 500 characters.';
  return null;
}

export const personalRecordService = {
  async save(profileId: string, exerciseId: string, input: PersonalRecordInput, measure: 'REPS' | 'SECONDS', needsWeight: boolean): Promise<void> {
    const problem = validatePersonalRecord(input, measure, needsWeight);
    if (problem) throw new CloudError(problem, 'validation');
    const row = await upsertRow<RecordRow>(
      'exercise_personal_records',
      {
        profile_id: profileId,
        exercise_id: exerciseId,
        record_date: input.recordDate,
        best_session: { weight: input.weight, unit: input.unit, reps: input.reps, sets: input.sets },
        notes: input.notes?.trim() ? input.notes.trim() : null,
      },
      'profile_id,exercise_id',
      'Could not save the personal record.',
    );
    cloudStore.applyUpserts('exercise_personal_records', [row]);
  },

  async remove(recordId: string): Promise<void> {
    ensureOk(await getSupabase().from('exercise_personal_records').delete().eq('id', recordId), 'Could not delete the personal record.');
    cloudStore.applyDeletes('exercise_personal_records', (row) => row.id === recordId);
  },
};
