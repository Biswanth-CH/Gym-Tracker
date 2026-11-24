import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../hooks/useHashRoute';
import { toFormVideo, toProfile, type ProfileRow } from '../services/cloud/rows';
import { validateFormVideoInput } from '../services/cloud/formVideoService';
import type { AttendanceStatus, CustomDayPlan, DateKey } from '../types/gym';
import { calculateCurrentStreak, calculateLongestStreak } from './consistencyUtils';
import { detectVideoPlatform, instagramPost, parseVideoUrl, readableUrl, videoPreviewFor, youtubeVideoId } from './formVideoLinks';
import { formatDayCount, ordinal, rankByCurrentStreak } from './leaderboard';
import { MIN_CONTRAST, contrastRatio, deriveThemePalette, normalizeHexColor } from './themeColor';
import { buildMonthWeeks, formatWeightCell, shiftMonth } from './weightCalendar';
import { copyDayWorkout, defaultCustomSchedule, isDayConfigured, normalizeSchedule, parseCustomSchedule } from './workoutPlan';
import {
  exerciseIdsOfRegion,
  regionIdsOfMuscleGroup,
  selectedExerciseIds,
  selectedRegionIds,
  setAllExercisesSelected,
  setAllRegionsSelected,
  setExerciseSelected,
  setMuscleGroupSelected,
  setRegionSelected,
} from './workoutSelection';

/* ---------- Copy one day to another ---------- */
describe('copy a workout day', () => {
  const upperChest = exerciseIdsOfRegion('upper-chest');
  const middleChest = exerciseIdsOfRegion('middle-chest');

  function mondayChestTriceps(): CustomDayPlan[] {
    const days = defaultCustomSchedule().map((day) => ({ ...day, muscleGroupIds: [...day.muscleGroupIds] }));
    let monday: CustomDayPlan = { dayId: 'monday', workoutName: 'Chest + Triceps', muscleGroupIds: [], isRest: false };
    monday = setMuscleGroupSelected(setMuscleGroupSelected(monday, 'chest', true), 'triceps', true);
    monday = setAllRegionsSelected(monday, 'chest', false);
    monday = setRegionSelected(monday, 'chest', 'upper-chest', true);
    monday = setRegionSelected(monday, 'chest', 'middle-chest', true);
    monday = setAllExercisesSelected(monday, 'chest', 'upper-chest', false);
    monday = setExerciseSelected(monday, 'chest', 'upper-chest', upperChest[0], true);
    monday = setAllExercisesSelected(monday, 'chest', 'middle-chest', false); // explicit empty CUSTOM
    return days.map((day) => (day.dayId === 'monday' ? monday : day));
  }

  it('copies groups, region modes, variation choices and explicit empty selections exactly', () => {
    const days = mondayChestTriceps();
    const copied = copyDayWorkout(days, 'monday', 'thursday');
    const monday = copied.find((day) => day.dayId === 'monday')!;
    const thursday = copied.find((day) => day.dayId === 'thursday')!;
    expect(thursday.dayId).toBe('thursday');
    expect(thursday.workoutName).toBe('Chest + Triceps');
    expect(thursday.muscleGroupIds).toEqual(monday.muscleGroupIds);
    expect(thursday.muscleGroupSelections).toEqual(monday.muscleGroupSelections);
    expect(selectedRegionIds(thursday, 'chest')).toEqual(['upper-chest', 'middle-chest']);
    expect(selectedExerciseIds(thursday, 'chest', 'upper-chest')).toEqual([upperChest[0]]);
    expect(selectedExerciseIds(thursday, 'chest', 'middle-chest')).toEqual([]);
    expect(middleChest.length).toBeGreaterThan(0);
  });

  it('keeps ALL as ALL (no frozen exercise list), so future library additions still appear', () => {
    const copied = copyDayWorkout(mondayChestTriceps(), 'monday', 'thursday');
    const thursday = copied.find((day) => day.dayId === 'thursday')!;
    // Triceps was never narrowed: no stored selection = ALL regions and ALL exercises.
    expect(thursday.muscleGroupSelections?.some((selection) => selection.muscleGroupId === 'triceps')).toBe(false);
    const stored = JSON.stringify(normalizeSchedule(copied));
    const tricepsExerciseIds = regionIdsOfMuscleGroup('triceps').flatMap(exerciseIdsOfRegion);
    expect(tricepsExerciseIds.length).toBeGreaterThan(0);
    for (const exerciseId of tricepsExerciseIds) expect(stored).not.toContain(`"${exerciseId}"`);
  });

  it('replaces the destination (no merge), leaves the source and other days unchanged', () => {
    const days = mondayChestTriceps();
    const before = JSON.stringify(days);
    const copied = copyDayWorkout(days, 'monday', 'tuesday');
    expect(JSON.stringify(days)).toBe(before); // input not mutated
    const tuesday = copied.find((day) => day.dayId === 'tuesday')!;
    expect(tuesday.muscleGroupIds).toEqual(['chest', 'triceps']); // Pull day replaced, not merged
    expect(copied.find((day) => day.dayId === 'monday')).toEqual(days.find((day) => day.dayId === 'monday'));
    expect(copied.find((day) => day.dayId === 'friday')).toEqual(days.find((day) => day.dayId === 'friday'));
    // Editing the copy never changes the source.
    tuesday.muscleGroupSelections![0].regions[0].exerciseIds.push('x');
    expect(copied.find((day) => day.dayId === 'monday')!.muscleGroupSelections![0].regions[0].exerciseIds).not.toContain('x');
  });

  it('copies a rest day too, refuses copying onto itself, and survives save → reopen', () => {
    const days = mondayChestTriceps();
    expect(() => copyDayWorkout(days, 'monday', 'monday')).toThrow(/different day/);
    const rest = copyDayWorkout(days, 'sunday', 'wednesday').find((day) => day.dayId === 'wednesday')!;
    expect(rest).toMatchObject({ isRest: true, muscleGroupIds: [] });
    expect(isDayConfigured(rest)).toBe(false);
    const copied = copyDayWorkout(days, 'monday', 'thursday');
    const reopened = parseCustomSchedule(JSON.parse(JSON.stringify({ days: normalizeSchedule(copied) })))!;
    expect(reopened.find((day) => day.dayId === 'thursday')!.muscleGroupSelections).toEqual(reopened.find((day) => day.dayId === 'monday')!.muscleGroupSelections);
  });
});

/* ---------- Form video links ---------- */
describe('form video links', () => {
  it('validates http(s) links and rejects unsafe or broken ones', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ ok: true, detectedPlatform: 'YOUTUBE' });
    expect(parseVideoUrl('youtu.be/dQw4w9WgXcQ')).toMatchObject({ ok: true, url: 'https://youtu.be/dQw4w9WgXcQ' });
    for (const bad of ['', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com/v', 'not a url', 'https://localhost']) {
      expect(parseVideoUrl(bad).ok, bad).toBe(false);
    }
  });

  it('detects the platform from common URL formats', () => {
    expect(detectVideoPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('YOUTUBE');
    expect(detectVideoPlatform('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('YOUTUBE');
    expect(detectVideoPlatform('https://www.instagram.com/reel/C1a2b3c4d5/')).toBe('INSTAGRAM');
    expect(detectVideoPlatform('https://vimeo.com/12345')).toBe('OTHER');
    expect(detectVideoPlatform('https://')).toBeNull();
  });

  it('extracts YouTube ids from watch, youtu.be, shorts, embed and live links', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) {
      expect(youtubeVideoId(url), url).toBe('dQw4w9WgXcQ');
    }
    expect(youtubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/@channel')).toBeNull();
  });

  it('builds official, non-autoplay embeds only when certain; otherwise a link card', () => {
    const youtube = videoPreviewFor('https://youtu.be/dQw4w9WgXcQ', 'YOUTUBE');
    expect(youtube).toMatchObject({ kind: 'youtube' });
    expect(youtube.kind === 'youtube' && youtube.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&autoplay=0');
    expect(instagramPost('https://www.instagram.com/reels/C1a2b3c4d5/')).toEqual({ kind: 'reel', code: 'C1a2b3c4d5' });
    expect(videoPreviewFor('https://www.instagram.com/p/C1a2b3c4d5/', 'INSTAGRAM')).toEqual({ kind: 'instagram', embedUrl: 'https://www.instagram.com/p/C1a2b3c4d5/embed/' });
    expect(videoPreviewFor('https://www.instagram.com/someprofile/', 'INSTAGRAM')).toEqual({ kind: 'link' });
    expect(videoPreviewFor('https://www.youtube.com/@channel', 'YOUTUBE')).toEqual({ kind: 'link' });
    expect(videoPreviewFor('https://example.com/video', 'OTHER')).toEqual({ kind: 'link' });
    // A YouTube link saved as "Other" is shown as a link card (the user's choice wins).
    expect(videoPreviewFor('https://youtu.be/dQw4w9WgXcQ', 'OTHER')).toEqual({ kind: 'link' });
  });

  it('validates the form like the service and database', () => {
    expect(validateFormVideoInput({ videoName: '  Elbow path  ', videoUrl: 'youtu.be/dQw4w9WgXcQ', platform: 'YOUTUBE' })).toEqual({
      video_name: 'Elbow path',
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
      platform: 'YOUTUBE',
    });
    expect(() => validateFormVideoInput({ videoName: ' ', videoUrl: 'https://a.com/v', platform: 'OTHER' })).toThrow(/name/);
    expect(() => validateFormVideoInput({ videoName: 'x', videoUrl: 'javascript:alert(1)', platform: 'OTHER' })).toThrow();
    expect(readableUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('maps rows defensively', () => {
    const row = { id: 'v', created_by: 'u', exercise_id: 'e', video_name: ' Cue ', video_url: 'https://a.com/v', platform: 'OTHER', created_at: 't', updated_at: 't' };
    expect(toFormVideo(row)).toMatchObject({ videoName: 'Cue', platform: 'OTHER' });
    expect(toFormVideo({ ...row, platform: 'TIKTOK' })).toBeNull();
    expect(toFormVideo({ ...row, video_url: 'javascript:alert(1)' })).toBeNull();
  });
});

/* ---------- Custom theme colour ---------- */
describe('custom theme colours', () => {
  const surface = '#1B1F26';
  it('normalises HEX input', () => {
    expect(normalizeHexColor('4f46e5')).toBe('#4F46E5');
    expect(normalizeHexColor('#4F46E5')).toBe('#4F46E5');
    expect(normalizeHexColor('#4F46E')).toBeNull();
    expect(normalizeHexColor(null)).toBeNull();
  });

  it('keeps readable contrast for very dark, very light and mid colours', () => {
    for (const hex of ['#000000', '#101828', '#4F46E5', '#7F1D1D', '#FFFFFF', '#FFFF00', '#808080', '#C6F432']) {
      const palette = deriveThemePalette(hex);
      expect(contrastRatio(palette.brand, surface), `${hex} brand on surface`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(palette.brandInk, palette.brand), `${hex} ink on brand`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(palette.brandRgb).toMatch(/^\d+, \d+, \d+$/);
    }
  });

  it('only lightens when needed and keeps already-readable colours exactly', () => {
    expect(deriveThemePalette('#C6F432')).toMatchObject({ brand: '#C6F432', adjusted: false });
    const dark = deriveThemePalette('#101828');
    expect(dark.adjusted).toBe(true);
    expect(dark.brand).not.toBe('#101828');
    expect(deriveThemePalette('#FFFFFF').brandInk).toBe('#0b0d10');
  });

  it('maps the column and keeps preset profiles on their preset', () => {
    const row: ProfileRow = { id: 'p', owner_id: 'u', name: 'A', gender: 'MALE', photo_path: null, tracking_start_date: '2026-01-01', created_at: 't', updated_at: 't', theme_key: 'teal' };
    expect(toProfile(row, null)).toMatchObject({ themeKey: 'teal', customThemeColor: null });
    expect(toProfile({ ...row, custom_theme_color: '#4f46e5' }, null).customThemeColor).toBe('#4F46E5');
    expect(toProfile({ ...row, custom_theme_color: 'red' }, null).customThemeColor).toBeNull();
  });
});

/* ---------- Streaks and leaderboard ---------- */
describe('highest streak and current-streak leaderboard', () => {
  const attendance = (entries: Array<[DateKey, AttendanceStatus]>) => new Map(entries);
  // 2026-11-02 is a Monday.
  const context = { todayKey: '2026-11-24', trackingStartKey: '2026-11-02' };

  it('uses the current-streak rules: Sundays skipped, missed / unmarked break, today unmarked does not', () => {
    const map = attendance([
      ['2026-11-02', 'ATTENDED'], ['2026-11-03', 'ATTENDED'], ['2026-11-04', 'ATTENDED'], ['2026-11-05', 'ATTENDED'],
      ['2026-11-06', 'ATTENDED'], ['2026-11-07', 'ATTENDED'], // Sun 8th skipped
      ['2026-11-09', 'ATTENDED'], ['2026-11-10', 'MISSED'],
      ['2026-11-20', 'ATTENDED'], ['2026-11-21', 'ATTENDED'], ['2026-11-23', 'ATTENDED'], // Sun 22nd skipped, today 24th unmarked
    ]);
    expect(calculateLongestStreak(map, context)).toBe(7);
    expect(calculateCurrentStreak(map, context)).toBe(3);
    expect(calculateLongestStreak(new Map(), context)).toBe(0);
    expect(calculateLongestStreak(map, { todayKey: '2026-11-01', trackingStartKey: '2026-11-02' })).toBe(0);
  });

  it('highest streak is never below the current streak', () => {
    const map = attendance([['2026-11-23', 'ATTENDED'], ['2026-11-24', 'ATTENDED']]);
    expect(calculateLongestStreak(map, context)).toBeGreaterThanOrEqual(calculateCurrentStreak(map, context));
  });

  it('competition ranking by current streak: ties share a rank, the next rank skips, every first place gets the crown', () => {
    const ranked = rankByCurrentStreak([
      { profileId: 'D', currentStreak: 5 },
      { profileId: 'A', currentStreak: 12 },
      { profileId: 'C', currentStreak: 8 },
      { profileId: 'B', currentStreak: 12 },
    ]);
    expect(ranked.map((entry) => [entry.profileId, entry.currentStreak, entry.rank, entry.isLeader])).toEqual([
      ['A', 12, 1, true], ['B', 12, 1, true], ['C', 8, 3, false], ['D', 5, 4, false],
    ]);
    expect(ranked.map((entry) => ordinal(entry.rank))).toEqual(['1st', '1st', '3rd', '4th']);
  });

  it('speaks the day count with correct singular / plural', () => {
    expect(formatDayCount(0)).toBe('0 days');
    expect(formatDayCount(1)).toBe('1 day');
    expect(formatDayCount(2)).toBe('2 days');
    expect(formatDayCount(12)).toBe('12 days');
  });

  it('handles zero streaks and empty accounts', () => {
    expect(rankByCurrentStreak([])).toEqual([]);
    const zeros = rankByCurrentStreak([{ profileId: 'A', currentStreak: 0 }, { profileId: 'B', currentStreak: 0 }]);
    expect(zeros.map((entry) => [entry.rank, entry.currentStreak])).toEqual([[1, 0], [1, 0]]);
    expect(zeros.some((entry) => entry.isLeader)).toBe(false); // no crown for a 0-day "lead"
    const mixed = rankByCurrentStreak([{ profileId: 'A', currentStreak: 0 }, { profileId: 'B', currentStreak: 3 }]);
    expect(mixed.map((entry) => [entry.profileId, entry.rank])).toEqual([['B', 1], ['A', 2]]); // 0 still listed
    expect(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'].join()).toBe([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal).join());
  });

  it('ranks by the ongoing streak, not the historical highest, and reacts to attendance changes', () => {
    // Mirrors useProfileStreaks: attendance → calculateCurrentStreak → rankByCurrentStreak.
    const rank = (maps: Record<string, Map<DateKey, AttendanceStatus>>) =>
      rankByCurrentStreak(Object.entries(maps).map(([profileId, map]) => ({ profileId, currentStreak: calculateCurrentStreak(map, context) })));
    // A: long 7-day record earlier in the month, now only 1 day ongoing. B: 3 days ongoing.
    const a = attendance([
      ['2026-11-02', 'ATTENDED'], ['2026-11-03', 'ATTENDED'], ['2026-11-04', 'ATTENDED'], ['2026-11-05', 'ATTENDED'],
      ['2026-11-06', 'ATTENDED'], ['2026-11-07', 'ATTENDED'], ['2026-11-09', 'ATTENDED'], ['2026-11-10', 'MISSED'],
      ['2026-11-21', 'MISSED'], ['2026-11-23', 'ATTENDED'],
    ]);
    const b = attendance([['2026-11-20', 'ATTENDED'], ['2026-11-21', 'ATTENDED'], ['2026-11-23', 'ATTENDED']]);
    expect(calculateLongestStreak(a, context)).toBe(7); // historical record is unchanged…
    let ranked = rank({ A: a, B: b });
    expect(ranked.map((entry) => [entry.profileId, entry.currentStreak, entry.rank])).toEqual([['B', 3, 1], ['A', 1, 2]]); // …but not used

    // B misses a day (today): the broken streak drops B immediately.
    const bBroken = new Map(b).set('2026-11-24', 'MISSED');
    ranked = rank({ A: a, B: bBroken });
    expect(ranked.map((entry) => [entry.profileId, entry.currentStreak, entry.rank, entry.isLeader])).toEqual([['A', 1, 1, true], ['B', 0, 2, false]]);

    // A marks today as attended: A extends its streak and keeps first place.
    const aToday = new Map(a).set('2026-11-24', 'ATTENDED');
    ranked = rank({ A: aToday, B: bBroken });
    expect(ranked[0]).toMatchObject({ profileId: 'A', currentStreak: 2, rank: 1, isLeader: true });

    // Both reach the same ongoing streak → shared first place, two crowns.
    const bRecovered = new Map(b).set('2026-11-24', 'ATTENDED');
    ranked = rank({ A: aToday, B: attendance([['2026-11-23', 'ATTENDED'], ['2026-11-24', 'ATTENDED']]) });
    expect(ranked.map((entry) => [entry.rank, entry.isLeader])).toEqual([[1, true], [1, true]]);
    expect(rank({ A: aToday, B: bRecovered })[0]).toMatchObject({ profileId: 'B', currentStreak: 4 });
  });
});

/* ---------- Weight Data calendar and routes ---------- */
describe('weight data calendar and Phase 7 routes', () => {
  it('builds Monday-first month weeks', () => {
    const weeks = buildMonthWeeks(2026, 10); // November 2026 starts on a Sunday
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('formats short cell values in kg or lb', () => {
    expect(formatWeightCell(78.5, 'KG')).toBe('78.5');
    expect(formatWeightCell(80, 'KG')).toBe('80');
    expect(formatWeightCell(78.5, 'LB')).toBe('173.1');
  });

  it('round-trips the new routes', () => {
    for (const hash of [
      '#/profile/p1/overview/weight-data',
      '#/profile/p1/consistency/weight-data',
      '#/profile/p1/consistency/monthly-statistics',
      '#/profile/p1/day/monday/muscle/back/region/lats/exercise/plate-loaded-t-bar-row-short-grip/form',
      '#/profile/p1/library/muscle/back/region/lower-back/exercise/roman-chair-back-extension/form',
      '#/profile/p1/library/muscle/back/region/lower-back/exercise/roman-chair-back-extension',
    ]) {
      expect(routeToHash(parseHash(hash))).toBe(hash);
    }
    expect(parseHash('#/profile/p1/overview')).toEqual({ name: 'overview', profileId: 'p1' });
    expect(parseHash('#/profile/p1/consistency/weight-data')).toEqual({ name: 'weight-data', profileId: 'p1', from: 'consistency' });
  });
});
