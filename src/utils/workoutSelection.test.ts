import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, getExercisesForRegion } from '../constants/exerciseLibrary';
import { MUSCLE_GROUPS, MUSCLE_GROUPS_BY_ID } from '../constants/muscleGroups';
import type { CustomDayPlan } from '../types/gym';
import { customDayToWorkoutDay, defaultCustomSchedule, normalizeSchedule, parseCustomSchedule } from './workoutPlan';
import {
  allowedExerciseIdsByRegion,
  exerciseIdsOfRegion,
  regionIdsOfMuscleGroup,
  selectedExerciseIds,
  selectedRegionIds,
  setAllExercisesSelected,
  setAllRegionsSelected,
  setExerciseSelected,
  setMuscleGroupSelected,
  setRegionSelected,
  summarizeMuscleGroupSelection,
} from './workoutSelection';

const emptyMonday = (): CustomDayPlan => ({ dayId: 'monday', workoutName: 'Upper', muscleGroupIds: [], isRest: false });
const chestRegions = regionIdsOfMuscleGroup('chest');
const upperChestExercises = exerciseIdsOfRegion('upper-chest');

/** Simulates Save → store JSON → reload → open the editor again. */
function saveAndReopen(day: CustomDayPlan): CustomDayPlan {
  const days = defaultCustomSchedule().map((candidate) => (candidate.dayId === day.dayId ? day : candidate));
  const stored = JSON.parse(JSON.stringify({ days: normalizeSchedule(days) }));
  const parsed = parseCustomSchedule(stored);
  if (!parsed) throw new Error('schedule did not parse');
  return parsed.find((candidate) => candidate.dayId === day.dayId)!;
}

describe('exercise library mapping (stable ids, explicit targets only)', () => {
  it('maps every exercise to existing regions of the right muscle group', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(exercise.targets.length, exercise.id).toBeGreaterThan(0);
      for (const target of exercise.targets) {
        expect(regionIdsOfMuscleGroup(target.muscleGroupId), `${exercise.id} → ${target.regionId}`).toContain(target.regionId);
      }
    }
  });

  it('every region offers at least one variation, and only through explicit targets', () => {
    for (const group of MUSCLE_GROUPS) {
      for (const region of group.regions) {
        const ids = exerciseIdsOfRegion(region.id);
        expect(ids.length, region.id).toBeGreaterThan(0);
        expect(ids).toEqual(getExercisesForRegion(region.id).map((exercise) => exercise.id));
      }
    }
  });

  it('does not list a chest press under triceps just because triceps are a secondary muscle', () => {
    const tricepsExerciseIds = new Set(regionIdsOfMuscleGroup('triceps').flatMap(exerciseIdsOfRegion));
    for (const exerciseId of upperChestExercises) {
      const exercise = EXERCISE_LIBRARY.find((candidate) => candidate.id === exerciseId)!;
      const explicitlyTriceps = exercise.targets.some((target) => target.muscleGroupId === 'triceps');
      expect(tricepsExerciseIds.has(exerciseId)).toBe(explicitlyTriceps);
    }
  });
});

describe('three-level selection defaults (missing = ALL)', () => {
  it('selecting Chest selects all chest regions and all their mapped exercises', () => {
    const day = setMuscleGroupSelected(emptyMonday(), 'chest', true);
    expect(selectedRegionIds(day, 'chest')).toEqual(chestRegions);
    for (const regionId of chestRegions) expect(selectedExerciseIds(day, 'chest', regionId)).toEqual(exerciseIdsOfRegion(regionId));
    expect(day.muscleGroupSelections ?? []).toEqual([]); // nothing stored = ALL
  });

  it('selecting another group also selects all its regions and variations', () => {
    const day = setMuscleGroupSelected(setMuscleGroupSelected(emptyMonday(), 'chest', true), 'triceps', true);
    expect(selectedRegionIds(day, 'triceps')).toEqual(regionIdsOfMuscleGroup('triceps'));
    const summary = summarizeMuscleGroupSelection(day, 'triceps');
    expect(summary.selectedExerciseCount).toBe(summary.totalExerciseCount);
  });

  it('legacy days without selection fields keep every region and variation', () => {
    const legacy = parseCustomSchedule({ days: defaultCustomSchedule() })!;
    const monday = legacy.find((day) => day.dayId === 'monday')!;
    expect(monday.muscleGroupSelections).toBeUndefined();
    for (const groupId of monday.muscleGroupIds) {
      expect(selectedRegionIds(monday, groupId)).toEqual(regionIdsOfMuscleGroup(groupId));
    }
    const workoutDay = customDayToWorkoutDay(monday)!;
    expect(allowedExerciseIdsByRegion(workoutDay, 'chest').get('upper-chest')?.size).toBe(upperChestExercises.length);
  });

  it('a missing or unreadable mode falls back to ALL, never NONE', () => {
    const parsed = parseCustomSchedule({
      days: defaultCustomSchedule().map((day) =>
        day.dayId === 'monday'
          ? { ...day, muscleGroupSelections: [{ muscleGroupId: 'chest', regions: [{ regionId: 'upper-chest', exerciseSelectionMode: 'WHAT' }] }] }
          : day,
      ),
    })!;
    const monday = parsed.find((day) => day.dayId === 'monday')!;
    expect(selectedRegionIds(monday, 'chest')).toEqual(chestRegions);
    expect(selectedExerciseIds(monday, 'chest', 'upper-chest')).toEqual(upperChestExercises);
  });
});

describe('Select All / Deselect All and individual choices', () => {
  const chestDay = () => setMuscleGroupSelected(emptyMonday(), 'chest', true);

  it('Deselect All Regions leaves an explicit empty selection; Select All restores everything', () => {
    const none = setAllRegionsSelected(chestDay(), 'chest', false);
    expect(selectedRegionIds(none, 'chest')).toEqual([]);
    expect(none.muscleGroupIds).toContain('chest');
    expect(selectedRegionIds(saveAndReopen(none), 'chest')).toEqual([]); // explicit CUSTOM [] survives
    const all = setAllRegionsSelected(none, 'chest', true);
    expect(selectedRegionIds(all, 'chest')).toEqual(chestRegions);
  });

  it('individual regions can be chosen (multiple), others are kept', () => {
    let day = setAllRegionsSelected(chestDay(), 'chest', false);
    day = setRegionSelected(day, 'chest', 'upper-chest', true);
    day = setRegionSelected(day, 'chest', 'middle-chest', true);
    expect(selectedRegionIds(day, 'chest')).toEqual(['upper-chest', 'middle-chest']);
    // A newly added region starts with ALL its exercises.
    expect(selectedExerciseIds(day, 'chest', 'middle-chest')).toEqual(exerciseIdsOfRegion('middle-chest'));
    day = setRegionSelected(day, 'chest', 'upper-chest', false);
    expect(selectedRegionIds(day, 'chest')).toEqual(['middle-chest']);
  });

  it('Deselect All Exercises → none; Select All Exercises → all again', () => {
    const none = setAllExercisesSelected(chestDay(), 'chest', 'upper-chest', false);
    expect(selectedExerciseIds(none, 'chest', 'upper-chest')).toEqual([]);
    expect(selectedRegionIds(none, 'chest')).toEqual(chestRegions); // region stays selected
    expect(selectedExerciseIds(saveAndReopen(none), 'chest', 'upper-chest')).toEqual([]);
    const all = setAllExercisesSelected(none, 'chest', 'upper-chest', true);
    expect(selectedExerciseIds(all, 'chest', 'upper-chest')).toEqual(upperChestExercises);
  });

  it('narrowing to one variation keeps it exactly through save and reopen', () => {
    const [firstExercise, secondExercise] = upperChestExercises;
    let day = setAllExercisesSelected(chestDay(), 'chest', 'upper-chest', false);
    day = setExerciseSelected(day, 'chest', 'upper-chest', firstExercise, true);
    expect(selectedExerciseIds(day, 'chest', 'upper-chest')).toEqual([firstExercise]);
    day = setExerciseSelected(day, 'chest', 'upper-chest', secondExercise, true);
    expect(selectedExerciseIds(day, 'chest', 'upper-chest')).toEqual([firstExercise, secondExercise]);
    const reopened = saveAndReopen(day);
    expect(selectedExerciseIds(reopened, 'chest', 'upper-chest')).toEqual([firstExercise, secondExercise]);
    // Other chest regions were not narrowed and stay ALL.
    expect(selectedExerciseIds(reopened, 'chest', 'lower-chest')).toEqual(exerciseIdsOfRegion('lower-chest'));
  });

  it('unticking one variation from ALL keeps all the others selected', () => {
    const day = setExerciseSelected(chestDay(), 'chest', 'upper-chest', upperChestExercises[0], false);
    expect(selectedExerciseIds(day, 'chest', 'upper-chest')).toEqual(upperChestExercises.slice(1));
  });

  it('re-adding a region does not silently restore exercises the user narrowed elsewhere', () => {
    let day = setExerciseSelected(chestDay(), 'chest', 'upper-chest', upperChestExercises[0], false);
    day = setRegionSelected(day, 'chest', 'lower-chest', false);
    day = setRegionSelected(day, 'chest', 'lower-chest', true);
    expect(selectedExerciseIds(day, 'chest', 'upper-chest')).toEqual(upperChestExercises.slice(1));
  });

  it('deselecting the muscle group removes it and all its child selections', () => {
    let day = setAllExercisesSelected(chestDay(), 'chest', 'upper-chest', false);
    day = setMuscleGroupSelected(day, 'chest', false);
    expect(day.muscleGroupIds).not.toContain('chest');
    expect(day.muscleGroupSelections ?? []).toEqual([]);
    expect(selectedRegionIds(day, 'chest')).toEqual([]);
    // Selecting it again starts fresh at ALL.
    expect(selectedRegionIds(setMuscleGroupSelected(day, 'chest', true), 'chest')).toEqual(chestRegions);
  });

  it('stores stable ids only and keeps the spec JSON shape', () => {
    let day = setAllRegionsSelected(chestDay(), 'chest', false);
    day = setRegionSelected(day, 'chest', 'upper-chest', true);
    day = setAllExercisesSelected(day, 'chest', 'upper-chest', false);
    day = setExerciseSelected(day, 'chest', 'upper-chest', upperChestExercises[0], true);
    const stored = normalizeSchedule([day])[0];
    expect(stored.muscleGroupSelections).toEqual([
      {
        muscleGroupId: 'chest',
        regionSelectionMode: 'CUSTOM',
        regions: [{ regionId: 'upper-chest', exerciseSelectionMode: 'CUSTOM', exerciseIds: [upperChestExercises[0]] }],
      },
    ]);
  });

  it('day details only expose the chosen regions and variations', () => {
    let day = setMuscleGroupSelected(setMuscleGroupSelected(emptyMonday(), 'chest', true), 'triceps', true);
    day = setAllRegionsSelected(day, 'chest', false);
    day = setRegionSelected(day, 'chest', 'upper-chest', true);
    day = setRegionSelected(day, 'chest', 'middle-chest', true);
    day = setAllExercisesSelected(day, 'chest', 'upper-chest', false);
    day = setExerciseSelected(day, 'chest', 'upper-chest', upperChestExercises[0], true);
    const workoutDay = customDayToWorkoutDay(saveAndReopen(day))!;
    const chest = allowedExerciseIdsByRegion(workoutDay, 'chest');
    expect([...chest.keys()]).toEqual(['upper-chest', 'middle-chest']);
    expect([...chest.get('upper-chest')!]).toEqual([upperChestExercises[0]]);
    expect(chest.get('middle-chest')!.size).toBe(exerciseIdsOfRegion('middle-chest').length);
    expect(allowedExerciseIdsByRegion(workoutDay, 'triceps').size).toBe(MUSCLE_GROUPS_BY_ID.triceps.regions.length);
  });

  it('rest days carry no selections', () => {
    const rest = normalizeSchedule([{ ...setAllRegionsSelected(chestDay(), 'chest', false), isRest: true }])[0];
    expect(rest.muscleGroupIds).toEqual([]);
    expect(rest.muscleGroupSelections).toBeUndefined();
  });
});
