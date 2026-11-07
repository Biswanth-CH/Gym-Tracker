import { describe, expect, it } from 'vitest';
import { stretchesForMuscleGroups } from './stretchPlan';

describe('stretch mapping', () => {
  it('returns chest and triceps stretches once each', () => {
    const pre = stretchesForMuscleGroups(['chest', 'triceps'], 'WARMUP').map((stretch) => stretch.id);
    const post = stretchesForMuscleGroups(['chest', 'triceps'], 'COOLDOWN').map((stretch) => stretch.id);
    expect(pre).toContain('dynamic-chest-opener');
    expect(pre).toContain('band-external-rotation');
    expect(new Set(pre).size).toBe(pre.length);
    expect(post).toEqual(expect.arrayContaining(['doorway-chest-stretch', 'overhead-triceps-stretch']));
    expect(post.some((id) => id.includes('hamstring'))).toBe(false);
  });

  it('dedupes a stretch shared by back and abs', () => {
    const post = stretchesForMuscleGroups(['back', 'abs'], 'COOLDOWN').map((stretch) => stretch.id);
    expect(post.filter((id) => id === 'childs-pose')).toHaveLength(1);
    expect(post).not.toContain('standing-quad-stretch');
  });

  it('uses only warm-ups before training and cooldowns after', () => {
    const pre = stretchesForMuscleGroups(['legs', 'biceps'], 'WARMUP');
    const post = stretchesForMuscleGroups(['legs', 'biceps'], 'COOLDOWN');
    expect(pre.every((stretch) => stretch.phase === 'WARMUP')).toBe(true);
    expect(post.every((stretch) => stretch.phase === 'COOLDOWN')).toBe(true);
    expect(pre.map((stretch) => stretch.id)).toEqual(expect.arrayContaining(['leg-swings-front-back', 'arm-swings']));
  });
});
