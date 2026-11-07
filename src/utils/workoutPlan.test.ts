import { describe, expect, it } from 'vitest';
import { WEEKLY_SCHEDULE } from '../constants/workoutSchedule';
import { defaultCustomSchedule, resolveActiveSchedule, validateCustomSchedule } from './workoutPlan';
import type { WorkoutPlan } from '../types/gym';

describe('workout plans', () => {
  it('uses the built-in PPL schedule when no custom plan is active', () => {
    const days = resolveActiveSchedule(null);
    expect(days.map((day) => day.id)).toEqual(WEEKLY_SCHEDULE.map((day) => day.id));
    expect(days[0].muscleGroupIds).toEqual(['chest', 'shoulders', 'triceps']);
    expect(days[6].category).toBe('rest');
  });

  it('keeps a saved custom split available while PPL is selected', () => {
    const custom = defaultCustomSchedule().map((day) =>
      day.dayId === 'monday' ? { ...day, workoutName: 'Chest Day', muscleGroupIds: ['chest', 'triceps'] as const, isRest: false } : day,
    );
    const plan: WorkoutPlan = {
      id: 'plan',
      profileId: 'profile',
      planType: 'PPL',
      splitName: 'Upper Lower',
      days: custom.map((day) => ({ ...day, muscleGroupIds: [...day.muscleGroupIds] })),
      updatedAt: '2026-11-07T00:00:00.000Z',
    };
    expect(resolveActiveSchedule(plan)[0].muscleGroupIds).toEqual(['chest', 'shoulders', 'triceps']);
    expect(resolveActiveSchedule({ ...plan, planType: 'CUSTOM' })[0].title).toBe('Chest Day');
    expect(resolveActiveSchedule({ ...plan, planType: 'CUSTOM' })[0].muscleGroupIds).toEqual(['chest', 'triceps']);
  });

  it('rejects an empty split name and a training day with no muscles', () => {
    const days = defaultCustomSchedule();
    expect(validateCustomSchedule('  ', days)).toMatch(/name/i);
    const blankMonday = days.map((day) => (day.dayId === 'monday' ? { ...day, isRest: false, muscleGroupIds: [], workoutName: 'Push' } : day));
    expect(validateCustomSchedule('My Split', blankMonday)).toMatch(/Monday/);
  });
});
