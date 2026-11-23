import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, EXERCISES_BY_ID, getExercisesForRegion } from './exerciseLibrary';
import { EQUIPMENT_BY_ID } from './gymEquipment';
import { regionIdsOfMuscleGroup } from '../utils/workoutSelection';

/** The rules the library header promises (equipment-only library, clean categories, stable ids). */
describe('exercise library integrity', () => {
  it('has unique stable ids and 139 exercises', () => {
    expect(new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id)).size).toBe(EXERCISE_LIBRARY.length);
    expect(EXERCISE_LIBRARY).toHaveLength(139);
  });

  it('only uses equipment from the gym inventory', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      for (const equipmentId of exercise.equipment) expect(EQUIPMENT_BY_ID.has(equipmentId), `${exercise.id} → ${equipmentId}`).toBe(true);
    }
  });

  it('keeps Machines & Cables and Alternatives apart', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      const kinds = exercise.equipment.map((id) => EQUIPMENT_BY_ID.get(id)!);
      if (exercise.category === 'MACHINE') {
        expect(kinds.some((item) => item.kind === 'MACHINE' || item.kind === 'CABLE'), exercise.id).toBe(true);
      } else {
        expect(kinds.every((item) => item.allowedInAlternatives), exercise.id).toBe(true);
      }
    }
  });

  it('maps every target to a real region of its group', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      for (const target of exercise.targets) expect(regionIdsOfMuscleGroup(target.muscleGroupId)).toContain(target.regionId);
    }
  });
});

describe('Phase 7 additions', () => {
  it('adds the Roman chair and the plate-loaded back machine as single equipment records', () => {
    expect(EQUIPMENT_BY_ID.get('roman-chair')).toMatchObject({ kind: 'BENCH', allowedInAlternatives: true });
    const machine = EQUIPMENT_BY_ID.get('plate-loaded-back-machine');
    expect(machine).toMatchObject({ kind: 'MACHINE', allowedInAlternatives: false });
    expect(machine!.supports.join(' ')).toMatch(/Cross Lat Pulldown/);
    expect(machine!.supports.join(' ')).toMatch(/T-Bar Row/);
  });

  it('Roman Chair Back Extension sits under Back → Lower Back with honest muscle mapping', () => {
    const exercise = EXERCISES_BY_ID.get('roman-chair-back-extension')!;
    expect(exercise.targets).toEqual([{ muscleGroupId: 'back', regionId: 'lower-back' }]);
    expect(exercise.equipment).toEqual(['roman-chair']);
    expect(exercise.primaryMuscles.join(' ')).toMatch(/Erector spinae/);
    expect(exercise.secondaryMuscles).toEqual(expect.arrayContaining(['Gluteus maximus', 'Hamstrings']));
    expect(exercise.commonMistakes.join(' ')).toMatch(/hyperextension/i);
    expect(`${exercise.setupNote} ${exercise.instructions.join(' ')}`).not.toMatch(/\bisolat(es|ion)\b(?! not)/i);
    expect(exercise.setupNote).toMatch(/not isolated/);
    expect(exercise.media.repdbId).toBe('back-extension');
    expect(getExercisesForRegion('lower-back').map((item) => item.id)).toContain('roman-chair-back-extension');
  });

  it('Cross Lat Pulldown has two grip variations on the plate-loaded machine, both lats-first', () => {
    const grips = ['plate-loaded-cross-lat-pulldown-overhand-grip', 'plate-loaded-cross-lat-pulldown-neutral-grip'].map((id) => EXERCISES_BY_ID.get(id)!);
    for (const exercise of grips) {
      expect(exercise.category).toBe('MACHINE');
      expect(exercise.equipment).toEqual(['plate-loaded-back-machine']);
      expect(exercise.targets[0]).toEqual({ muscleGroupId: 'back', regionId: 'lats' });
      expect(exercise.primaryMuscles).toEqual(['Latissimus dorsi']);
      expect(exercise.secondaryMuscles).toContain('Biceps');
    }
    expect(new Set(grips.map((exercise) => exercise.name)).size).toBe(2);
  });

  it('T-Bar Row has Wide Grip and Short Grip variations with distinct back mapping', () => {
    const wide = EXERCISES_BY_ID.get('plate-loaded-t-bar-row-wide-grip')!;
    const short = EXERCISES_BY_ID.get('plate-loaded-t-bar-row-short-grip')!;
    expect(wide.name).toBe('T-Bar Row – Wide Grip');
    expect(short.name).toBe('T-Bar Row – Short Grip');
    expect(wide.targets[0].regionId).toBe('mid-back');
    expect(short.targets.map((target) => target.regionId)).toEqual(['lats', 'mid-back']);
    for (const exercise of [wide, short]) {
      expect(exercise.equipment).toEqual(['plate-loaded-back-machine']);
      expect(exercise.media.repdbId).toBe('t-bar-row');
      expect(getExercisesForRegion('mid-back', 'MACHINE').map((item) => item.id)).toContain(exercise.id);
    }
  });
});
