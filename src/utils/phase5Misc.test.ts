import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '../constants/muscleGroups';
import { parseHash, routeToHash } from '../hooks/useHashRoute';
import { RECOVERY_LINK_INVALID_MESSAGE, readAuthRedirect } from '../services/cloud/authService';
import { toProfile, type ProfileRow } from '../services/cloud/rows';
import { calculateBmi, formatBmi, formatHeightCm, parseAgeInput, parseHeightInput, validateProfileDetails } from './profileDetails';
import { stretchesForMuscleGroups } from './stretchPlan';

const APP = 'https://biswanth-ch.github.io/Gym-Tracker/';

describe('password recovery redirects', () => {
  it('detects a PKCE code on the GitHub Pages subpath and on localhost', () => {
    expect(readAuthRedirect(`${APP}?code=abc123#/`)).toMatchObject({ hasAuthCode: true, errorMessage: null });
    expect(readAuthRedirect('http://localhost:5173/?code=abc123')).toMatchObject({ hasAuthCode: true });
  });

  it('reads a token-hash recovery link (works in any browser)', () => {
    const info = readAuthRedirect(`${APP}?token_hash=pkce_123&type=recovery`);
    expect(info.recoveryTokenHash).toBe('pkce_123');
    expect(info.isRecoveryLink).toBe(true);
    // token_hash without type=recovery is not treated as a password reset.
    expect(readAuthRedirect(`${APP}?token_hash=x&type=signup`).recoveryTokenHash).toBeNull();
  });

  it('turns an expired or reused link error in the hash into a friendly message', () => {
    const info = readAuthRedirect(
      `${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    expect(info.errorMessage).toBe(RECOVERY_LINK_INVALID_MESSAGE);
    expect(readAuthRedirect(`${APP}?error=access_denied&error_code=otp_expired`).errorMessage).toBe(RECOVERY_LINK_INVALID_MESSAGE);
  });

  it('ignores normal hash routes', () => {
    expect(readAuthRedirect(`${APP}#/profile/123/day/monday`)).toEqual({
      hasAuthCode: false,
      recoveryTokenHash: null,
      isRecoveryLink: false,
      errorMessage: null,
    });
  });
});

describe('profile overview route', () => {
  it('round-trips #/profile/<id>/overview', () => {
    const route = parseHash('#/profile/abc/overview');
    expect(route).toEqual({ name: 'overview', profileId: 'abc' });
    expect(routeToHash(route)).toBe('#/profile/abc/overview');
    expect(parseHash('#/profile/abc/consistency')).toEqual({ name: 'consistency', profileId: 'abc' });
  });
});

describe('age and height', () => {
  it('accepts empty values as not provided and validates ranges', () => {
    expect(parseAgeInput('')).toEqual({ ok: true, value: null });
    expect(parseAgeInput(' 25 ')).toEqual({ ok: true, value: 25 });
    expect(parseAgeInput('25.5').ok).toBe(false);
    expect(parseAgeInput('7').ok).toBe(false);
    expect(parseHeightInput('175')).toEqual({ ok: true, value: 175 });
    expect(parseHeightInput('175,5')).toEqual({ ok: true, value: 175.5 });
    expect(parseHeightInput('175.55').ok).toBe(false);
    expect(parseHeightInput('300').ok).toBe(false);
    expect(validateProfileDetails(null, null)).toBeNull();
    expect(validateProfileDetails(25.5, null)).toMatch(/Age/);
    expect(formatHeightCm(175)).toBe('175 cm');
    expect(formatHeightCm(175.5)).toBe('175.5 cm');
  });

  it('maps numeric columns and keeps old rows (no Phase 5 columns) valid', () => {
    const row: ProfileRow = {
      id: 'p1',
      owner_id: 'u1',
      name: 'Biswanth',
      gender: 'MALE',
      photo_path: null,
      tracking_start_date: '2026-01-01',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(toProfile(row, null)).toMatchObject({ ageYears: null, heightCm: null });
    expect(toProfile({ ...row, age_years: 25, height_cm: '175.5' }, null)).toMatchObject({ ageYears: 25, heightCm: 175.5 });
  });
});

describe('BMI', () => {
  it('calculates kg / m² with a category, and needs both values', () => {
    expect(calculateBmi(175, 78.5)).toEqual({ value: 25.6, category: 'Overweight' });
    expect(calculateBmi(180, 70)).toEqual({ value: 21.6, category: 'Normal' });
    expect(calculateBmi(170, 50)?.category).toBe('Underweight');
    expect(calculateBmi(160, 90)?.category).toBe('Obese');
    expect(calculateBmi(null, 70)).toBeNull();
    expect(calculateBmi(175, null)).toBeNull();
    expect(formatBmi({ value: 21.6, category: 'Normal' })).toBe('21.6 (Normal)');
  });
});

describe('dynamic stretches for every muscle group', () => {
  it('maps all eight groups to both warm-ups and cooldowns', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(stretchesForMuscleGroups([group.id], 'WARMUP').length, `${group.id} warm-up`).toBeGreaterThan(0);
      expect(stretchesForMuscleGroups([group.id], 'COOLDOWN').length, `${group.id} cooldown`).toBeGreaterThan(0);
    }
  });

  it('combines a custom day (Upper Body: chest, back, shoulders) without duplicates or unrelated stretches', () => {
    const pre = stretchesForMuscleGroups(['chest', 'back', 'shoulders'], 'WARMUP').map((stretch) => stretch.id);
    const post = stretchesForMuscleGroups(['chest', 'back', 'shoulders'], 'COOLDOWN').map((stretch) => stretch.id);
    expect(new Set(pre).size).toBe(pre.length);
    expect(new Set(post).size).toBe(post.length);
    expect(pre).toEqual(expect.arrayContaining(['dynamic-chest-opener', 'arm-circles', 'thoracic-rotation', 'shoulder-wall-slides']));
    expect(post).toEqual(expect.arrayContaining(['doorway-chest-stretch', 'lat-stretch', 'cross-body-shoulder-stretch']));
    expect([...pre, ...post].some((id) => /leg|quad|hamstring|calf|glute/.test(id))).toBe(false);
  });

  it('gives abs dynamic trunk work before and cobra / child’s pose after', () => {
    expect(stretchesForMuscleGroups(['abs'], 'WARMUP').map((stretch) => stretch.id)).toEqual(['thoracic-rotation', 'hip-circles']);
    expect(stretchesForMuscleGroups(['abs'], 'COOLDOWN').map((stretch) => stretch.id)).toEqual(
      expect.arrayContaining(['cobra-stretch', 'childs-pose']),
    );
  });
});
