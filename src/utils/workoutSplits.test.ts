import { describe, expect, it } from 'vitest';
import { WEEKLY_SCHEDULE } from '../constants/workoutSchedule';
import type { CustomDayPlan, WorkoutPlan, WorkoutSplitTemplate } from '../types/gym';
import {
  BUILT_IN_PPL_NAME,
  activeSplitDays,
  activeSplitName,
  cloneSchedule,
  countTrainingDays,
  defaultCustomSchedule,
  duplicateSplitName,
  isSplitNameTaken,
  normalizeSchedule,
  resolveActiveSplit,
  validateCustomSchedule,
  SPLIT_NAME_MAX_LENGTH,
} from './workoutPlan';
import { toSplitTemplate, toWorkoutPlan } from '../services/cloud/rows';

const upperLowerDays: CustomDayPlan[] = defaultCustomSchedule().map((day) => {
  if (day.dayId === 'monday') return { ...day, workoutName: 'Upper Body', muscleGroupIds: ['chest', 'back', 'shoulders'], isRest: false };
  if (day.dayId === 'tuesday') return { ...day, workoutName: 'Lower Body', muscleGroupIds: ['legs', 'abs'], isRest: false };
  if (day.dayId === 'wednesday') return { ...day, workoutName: 'Rest', muscleGroupIds: [], isRest: true };
  return day;
});

const template = (id: string, splitName: string, days: CustomDayPlan[] = upperLowerDays, profileId = 'profile-a'): WorkoutSplitTemplate => ({
  id,
  profileId,
  splitName,
  days: cloneSchedule(days),
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
});

const plan = (overrides: Partial<WorkoutPlan>): WorkoutPlan => ({
  id: 'plan',
  profileId: 'profile-a',
  planType: 'PPL',
  splitName: 'My Split',
  days: defaultCustomSchedule(),
  activeTemplateId: null,
  updatedAt: '2026-11-08T00:00:00.000Z',
  ...overrides,
});

describe('multiple workout splits', () => {
  const upperLower = template('t-upper', 'Upper / Lower');
  const broSplit = template(
    't-bro',
    'Bro Split',
    defaultCustomSchedule().map((day) => (day.dayId === 'monday' ? { ...day, workoutName: 'Chest Day', muscleGroupIds: ['chest', 'triceps'] } : day)),
  );

  it('uses built-in PPL when there is no plan row or PPL is active', () => {
    expect(resolveActiveSplit(null, [upperLower]).kind).toBe('PPL');
    expect(resolveActiveSplit(plan({ planType: 'PPL', activeTemplateId: 't-upper' }), [upperLower]).kind).toBe('PPL');
    expect(activeSplitDays({ kind: 'PPL' })).toBe(WEEKLY_SCHEDULE);
    expect(activeSplitName({ kind: 'PPL' })).toBe(BUILT_IN_PPL_NAME);
  });

  it('restores the exact schedule of the active custom template', () => {
    const active = resolveActiveSplit(plan({ planType: 'CUSTOM', activeTemplateId: 't-bro' }), [upperLower, broSplit]);
    expect(active.kind).toBe('CUSTOM');
    const days = activeSplitDays(active);
    expect(days[0].title).toBe('Chest Day');
    expect(days[0].muscleGroupIds).toEqual(['chest', 'triceps']);
    expect(activeSplitName(active)).toBe('Bro Split');
  });

  it('switching PPL → custom → PPL never changes the saved templates', () => {
    const templates = [upperLower, broSplit];
    const snapshot = JSON.stringify(templates);
    resolveActiveSplit(plan({ planType: 'PPL', activeTemplateId: 't-upper' }), templates);
    const custom = resolveActiveSplit(plan({ planType: 'CUSTOM', activeTemplateId: 't-upper' }), templates);
    expect(activeSplitDays(custom)[1].muscleGroupIds).toEqual(['legs', 'abs']);
    expect(JSON.stringify(templates)).toBe(snapshot);
  });

  it('falls back to the legacy single custom schedule when the template is missing', () => {
    const legacy = plan({ planType: 'CUSTOM', splitName: 'Old Split', days: upperLowerDays, activeTemplateId: null });
    const active = resolveActiveSplit(legacy, []);
    expect(active).toMatchObject({ kind: 'LEGACY_CUSTOM', splitName: 'Old Split' });
    expect(activeSplitDays(active)[0].title).toBe('Upper Body');
    // A reference to a template that was deleted (or not loaded yet) also falls back safely.
    expect(resolveActiveSplit({ ...legacy, activeTemplateId: 'gone' }, [upperLower]).kind).toBe('LEGACY_CUSTOM');
  });

  it('keeps profiles isolated: another profile’s template id is never resolved', () => {
    const otherProfileTemplate = template('t-other', 'Other', upperLowerDays, 'profile-b');
    // The hook filters templates by profile before resolving, so only profile-a templates are passed.
    const profileATemplates = [upperLower, otherProfileTemplate].filter((candidate) => candidate.profileId === 'profile-a');
    const active = resolveActiveSplit(plan({ planType: 'CUSTOM', activeTemplateId: 't-other' }), profileATemplates);
    expect(active.kind).toBe('LEGACY_CUSTOM');
  });

  it('checks split names case-insensitively and reserves the built-in name', () => {
    expect(isSplitNameTaken('  upper / LOWER ', [upperLower])).toBe(true);
    expect(isSplitNameTaken('Upper / Lower', [upperLower], 't-upper')).toBe(false);
    expect(isSplitNameTaken('push pull legs', [])).toBe(true);
    expect(isSplitNameTaken('Personal Workout Plan', [upperLower, broSplit])).toBe(false);
  });

  it('creates unique duplicate names within the length limit', () => {
    expect(duplicateSplitName('Upper / Lower', [upperLower])).toBe('Upper / Lower (copy)');
    const withCopy = [upperLower, template('t-copy', 'Upper / Lower (copy)')];
    expect(duplicateSplitName('Upper / Lower', withCopy)).toBe('Upper / Lower (copy 2)');
    const long = 'A'.repeat(SPLIT_NAME_MAX_LENGTH);
    const copyName = duplicateSplitName(long, []);
    expect(copyName.length).toBeLessThanOrEqual(SPLIT_NAME_MAX_LENGTH);
    expect(copyName.endsWith('(copy)')).toBe(true);
    expect(duplicateSplitName(BUILT_IN_PPL_NAME, [])).toBe('Push Pull Legs (copy)');
  });

  it('normalises rest days and validates training days', () => {
    const draft = defaultCustomSchedule().map((day) =>
      day.dayId === 'sunday' ? { ...day, isRest: true, workoutName: '  ', muscleGroupIds: ['abs' as const] } : day,
    );
    const normalized = normalizeSchedule(draft);
    const sunday = normalized.find((day) => day.dayId === 'sunday');
    expect(sunday).toMatchObject({ workoutName: 'Rest', muscleGroupIds: [] });
    expect(validateCustomSchedule('Bro Split', normalized)).toBeNull();
    const unnamed = normalized.map((day) => (day.dayId === 'friday' ? { ...day, workoutName: '' } : day));
    expect(validateCustomSchedule('Bro Split', unnamed)).toMatch(/Friday/);
    expect(validateCustomSchedule('', normalized)).toMatch(/name/i);
  });

  it('counts training days and supports multiple muscle groups per day', () => {
    expect(countTrainingDays(defaultCustomSchedule())).toBe(6);
    expect(countTrainingDays(upperLowerDays)).toBe(5);
    expect(activeSplitDays({ kind: 'CUSTOM', template: upperLower })[0].muscleGroupIds).toEqual(['chest', 'back', 'shoulders']);
  });
});

describe('workout split rows', () => {
  it('maps template rows and rejects malformed schedules', () => {
    const row = {
      id: 't1',
      profile_id: 'p1',
      split_name: ' Upper / Lower ',
      weekly_schedule: { days: upperLowerDays },
      created_at: '2026-11-08T00:00:00Z',
      updated_at: '2026-11-08T00:00:00Z',
    };
    expect(toSplitTemplate(row)).toMatchObject({ id: 't1', splitName: 'Upper / Lower' });
    expect(toSplitTemplate({ ...row, weekly_schedule: { days: [] } })).toBeNull();
    expect(toSplitTemplate({ ...row, split_name: '  ' })).toBeNull();
  });

  it('reads the active template id, and tolerates projects without the Phase 5 column', () => {
    const base = {
      id: 'plan',
      profile_id: 'p1',
      plan_type: 'CUSTOM',
      split_name: 'Old Split',
      weekly_schedule: { days: upperLowerDays },
      updated_at: '2026-11-08T00:00:00Z',
    };
    expect(toWorkoutPlan({ ...base, active_split_template_id: 't1' })?.activeTemplateId).toBe('t1');
    expect(toWorkoutPlan(base)?.activeTemplateId).toBeNull();
  });
});
