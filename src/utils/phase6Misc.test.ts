import { describe, expect, it } from 'vitest';
import { PROFILE_THEMES, isProfileThemeKey } from '../constants/profileThemes';
import { parseHash, routeToHash } from '../hooks/useHashRoute';
import { describePinFailure, isValidPin, toPinCheckResult } from '../services/cloud/profilePinService';
import { toProfile, type ProfileRow } from '../services/cloud/rows';
import { formatStreak } from './streakDisplay';
import { MAX_TICKS, buildWeightAxisTicks } from './weightAxis';

describe('weight chart X axis', () => {
  it('last week: one day label per day (weekday over date) on local dates', () => {
    const ticks = buildWeightAxisTicks('2026-11-02', '2026-11-08');
    expect(ticks).toHaveLength(7);
    expect(ticks.map((tick) => tick.dateKey)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(ticks[0].sublabel).toBe('2');
    expect(ticks[0].label).toBe(new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2026, 10, 2)));
  });

  it('8–14 days: still day labels, thinned to avoid overlap', () => {
    const ticks = buildWeightAxisTicks('2026-11-01', '2026-11-14');
    expect(ticks.length).toBeLessThanOrEqual(MAX_TICKS);
    expect(ticks.every((tick) => /^\d+$/.test(tick.sublabel ?? ''))).toBe(true);
  });

  it('last month (30 days): week markers with their start date', () => {
    const ticks = buildWeightAxisTicks('2026-10-11', '2026-11-09');
    expect(ticks.map((tick) => tick.label)).toEqual(['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5']);
    expect(ticks[0].sublabel).toMatch(/11/);
  });

  it('15–90 day custom ranges use weeks, longer ranges use months, never more than 7 labels', () => {
    const ninety = buildWeightAxisTicks('2026-08-12', '2026-11-09');
    expect(ninety.every((tick) => tick.label.startsWith('Wk'))).toBe(true);
    expect(ninety.length).toBeLessThanOrEqual(MAX_TICKS);
    const year = buildWeightAxisTicks('2025-11-10', '2026-11-09');
    expect(year.length).toBeLessThanOrEqual(MAX_TICKS);
    expect(year.every((tick) => tick.dateKey.endsWith('-01'))).toBe(true);
    expect(year.some((tick) => /26$/.test(tick.label))).toBe(true); // year shown when it changes
  });

  it('handles a single day and an inverted range', () => {
    expect(buildWeightAxisTicks('2026-11-09', '2026-11-09')).toHaveLength(1);
    expect(buildWeightAxisTicks('2026-11-09', '2026-11-01')).toEqual([]);
  });
});

describe('profile PIN client helpers', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('1234')).toBe(true);
    for (const bad of ['123', '12345', '12a4', ' 1234', '']) expect(isValidPin(bad)).toBe(false);
  });

  it('maps server responses without ever needing the hash', () => {
    expect(toPinCheckResult({ ok: true, hasPin: true })).toEqual({ ok: true });
    expect(toPinCheckResult({ ok: false, attemptsRemaining: 2 })).toEqual({ ok: false, reason: 'wrong-pin', attemptsRemaining: 2 });
    const future = new Date(Date.now() + 120_000).toISOString();
    const locked = toPinCheckResult({ ok: false, lockedUntil: future, attemptsRemaining: 0 });
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    expect(describePinFailure(locked as Exclude<typeof locked, { ok: true }>)).toMatch(/2 minutes/);
    expect(toPinCheckResult({ ok: false, error: 'reauthentication-required' })).toEqual({ ok: false, reason: 'reauthentication-required' });
    expect(toPinCheckResult(null)).toMatchObject({ ok: false, reason: 'wrong-pin' });
  });
});

describe('themes, streaks, routes', () => {
  it('offers eight themes and defaults existing profiles to lime', () => {
    expect(PROFILE_THEMES.map((theme) => theme.key)).toEqual(['lime', 'blue', 'purple', 'crimson', 'amber', 'teal', 'rose', 'slate']);
    expect(isProfileThemeKey('neon')).toBe(false);
    const row: ProfileRow = {
      id: 'p',
      owner_id: 'u',
      name: 'A',
      gender: 'MALE',
      photo_path: null,
      tracking_start_date: '2026-01-01',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    expect(toProfile(row, null).themeKey).toBe('lime');
    expect(toProfile({ ...row, theme_key: 'teal' }, null).themeKey).toBe('teal');
    expect(toProfile({ ...row, theme_key: 'neon' }, null).themeKey).toBe('lime');
  });

  it('formats every streak with the fire emoji', () => {
    expect(formatStreak(0)).toBe('0 🔥');
    expect(formatStreak(12)).toBe('12 🔥');
  });

  it('round-trips the full library routes', () => {
    const routes = [
      '#/profile/p1/library',
      '#/profile/p1/library/muscle/chest',
      '#/profile/p1/library/muscle/chest/region/upper-chest',
      '#/profile/p1/library/muscle/chest/region/upper-chest/alternatives',
      '#/profile/p1/library/muscle/chest/region/upper-chest/exercise/x1',
    ];
    for (const hash of routes) expect(routeToHash(parseHash(hash))).toBe(hash);
    expect(parseHash('#/profile/p1/library/muscle/chest/region/upper-chest')).toMatchObject({ name: 'library-region', category: 'MACHINE' });
  });
});
