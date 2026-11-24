import { describe, expect, it } from 'vitest';
import { toBackgroundImage, toFormVideo, toProfile, toSplitBackground, type BackgroundImageRow, type FormVideoRow, type ProfileRow, type SplitBackgroundRow } from '../services/cloud/rows';
import { canDeleteBackgroundImage } from '../services/cloud/backgroundGalleryService';
import { groupGalleryImages } from './backgroundGallery';
import { parsePendingFileDeletes, pendingFileDeletesKey } from './pendingFileDeletes';
import type { BackgroundImage, CustomDayPlan, ExerciseFormVideo, SplitDayBackground } from '../types/gym';
import { DEFAULT_CARD_BACKGROUND_SETTINGS, backgroundLayerStyles, backgroundSettingsSummary, galleryImagePath, imageScale, normalizeBackgroundSettings } from './cardBackground';
import { DELETE_SHARED_VIDEO_WARNING, EDIT_SHARED_VIDEO_WARNING, splitVisibleVideos } from './formVideoVisibility';
import {
  SIGNED_URL_RENEW_MARGIN_MS,
  parseSignedUrlMap,
  pathsNeedingSignature,
  pruneSignedUrlMap,
  signedUrlStorageKey,
} from './signedUrlCache';
import { draftsFromStored, planBackgroundChanges } from './splitBackgrounds';
import { attendanceHeading, formatTodayWeight, todayLogStatus, todayWeightEntry, weightHeading } from './todayStatus';
import { cloneSchedule, copyDayWorkout, defaultCustomSchedule } from './workoutPlan';
import { selectedRegionIds, setAllRegionsSelected } from './workoutSelection';
import { toDateKey } from './dateUtils';
import { parseHash, routeToHash } from '../hooks/useHashRoute';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const PROFILE = 'aaaaaaaa-0000-4000-8000-000000000001';
const SPLIT = 'bbbbbbbb-0000-4000-8000-000000000001';
/** Same CHECK as account_split_day_backgrounds.storage_path in the Phase 8 migration. */
const DB_PATH_RULE = /^[0-9a-f-]{36}\/([0-9a-f-]{36}|splits)\/backgrounds\/[A-Za-z0-9._-]{1,120}$/;

const stored = (dayId: SplitDayBackground['dayId'], storagePath: string, overrides: Partial<SplitDayBackground> = {}): SplitDayBackground => ({
  id: `row-${dayId}`,
  splitId: SPLIT,
  dayId,
  storagePath,
  imageUrl: `https://signed/${storagePath}`,
  updatedAt: 't',
  ...DEFAULT_CARD_BACKGROUND_SETTINGS,
  ...overrides,
});

/* ---------- 1. Profile cards ---------- */
describe('profile card picture visibility', () => {
  const row: ProfileRow = { id: PROFILE, owner_id: USER, name: 'Bisss', gender: 'MALE', photo_path: null, tracking_start_date: '2026-01-01', created_at: 't', updated_at: 't' };
  it('shows the picture by default (before and after the migration)', () => {
    expect(toProfile(row, null).showPhotoOnCard).toBe(true);
    expect(toProfile({ ...row, show_photo_on_card: true }, null).showPhotoOnCard).toBe(true);
    expect(toProfile({ ...row, show_photo_on_card: null }, null).showPhotoOnCard).toBe(true);
  });
  it('hides it only when the setting is false; the photo path is kept', () => {
    const profile = toProfile({ ...row, photo_path: `${USER}/${PROFILE}/1.webp`, show_photo_on_card: false }, 'https://signed');
    expect(profile.showPhotoOnCard).toBe(false);
    expect(profile.photoPath).toBe(`${USER}/${PROFILE}/1.webp`);
    expect(profile.photoUrl).toBe('https://signed');
  });
});

/* ---------- 2. Zoom ---------- */
describe('background zoom', () => {
  it('defaults to 100 % and clamps to 100–300 %', () => {
    expect(DEFAULT_CARD_BACKGROUND_SETTINGS.zoomPercent).toBe(100);
    expect(normalizeBackgroundSettings({ zoomPercent: 40 }).zoomPercent).toBe(100);
    expect(normalizeBackgroundSettings({ zoomPercent: 999 }).zoomPercent).toBe(300);
    expect(normalizeBackgroundSettings({ zoomPercent: '152.4' }).zoomPercent).toBe(152);
    expect(normalizeBackgroundSettings({ zoomPercent: null }).zoomPercent).toBe(100);
  });
  it('scales the image layer around the focal point without stretching (cover keeps the aspect ratio)', () => {
    const styles = backgroundLayerStyles('https://x/a.webp', { ...DEFAULT_CARD_BACKGROUND_SETTINGS, zoomPercent: 200, focalX: 20, focalY: 70 });
    expect(styles.image.transform).toBe('scale(2)');
    expect(styles.image.transformOrigin).toBe('20% 70%');
    expect(styles.image.backgroundPosition).toBe('20% 70%');
    expect(styles.image).not.toHaveProperty('backgroundSize'); // stays `cover` from CSS
  });
  it('dim, blur and zoom are independent', () => {
    const base = { ...DEFAULT_CARD_BACKGROUND_SETTINGS, dimPercent: 30 };
    const zoomed = backgroundLayerStyles('https://x/a.webp', { ...base, zoomPercent: 150 });
    expect(zoomed.overlay.opacity).toBe(0.3);
    expect(zoomed.image.filter).toBeUndefined();
    const blurred = backgroundLayerStyles('https://x/a.webp', { ...base, zoomPercent: 150, blurPx: 10 });
    expect(blurred.image.filter).toBe('blur(10px)');
    expect(blurred.overlay.opacity).toBe(0.3);
    expect(imageScale({ ...base, zoomPercent: 150, blurPx: 10 })).toBe(1.65); // zoom × blur edge cover
    expect(backgroundLayerStyles('https://x/a.webp', DEFAULT_CARD_BACKGROUND_SETTINGS).image.transform).toBeUndefined();
  });
});

/* ---------- 3. Split backgrounds ---------- */
describe('split backgrounds: gallery references and save planning', () => {
  const mondayPath = `${USER}/splits/backgrounds/monday-1-abc.webp`;
  it('gallery upload paths sit in the uploading profile’s folder and satisfy the database rule', () => {
    const path = galleryImagePath(USER, PROFILE, 'image/webp', 1700000000000, 'x1y2z3');
    expect(path).toBe(`${USER}/${PROFILE}/backgrounds/bg-1700000000000-x1y2z3.webp`);
    expect(path).toMatch(DB_PATH_RULE);
    expect(mondayPath).toMatch(DB_PATH_RULE); // Phase 8 split-folder files stay valid
  });

  it('choosing the same gallery image for another day reuses the reference (no upload, nothing released)', () => {
    const rows = [stored('monday', mondayPath)];
    const drafts = draftsFromStored(rows);
    drafts.wednesday = { image: { kind: 'stored', storagePath: mondayPath, imageUrl: null }, settings: { ...DEFAULT_CARD_BACKGROUND_SETTINGS, zoomPercent: 180 } };
    const plan = planBackgroundChanges(rows, drafts);
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0]).toMatchObject({ dayId: 'wednesday', image: { storagePath: mondayPath }, settings: { zoomPercent: 180 } });
    expect(plan.deleteIds).toEqual([]);
    expect(plan).not.toHaveProperty('uploads');
  });

  it('unchanged days are not rewritten; removing a day deletes only its row (the image stays in the gallery)', () => {
    const rows = [stored('monday', mondayPath), stored('thursday', mondayPath), stored('friday', `${USER}/splits/backgrounds/fri.webp`)];
    const drafts = draftsFromStored(rows);
    expect(planBackgroundChanges(rows, drafts).upserts).toEqual([]);
    delete drafts.monday;
    delete drafts.friday;
    const plan = planBackgroundChanges(rows, drafts);
    expect(plan.deleteIds.sort()).toEqual(['row-friday', 'row-monday']);
    expect(plan).not.toHaveProperty('releasedPaths');
  });

  it('a setting change (e.g. zoom) is an update of that day only', () => {
    const rows = [stored('monday', mondayPath), stored('tuesday', mondayPath)];
    const drafts = draftsFromStored(rows);
    drafts.monday = { image: drafts.monday!.image, settings: { ...drafts.monday!.settings, zoomPercent: 220 } };
    const plan = planBackgroundChanges(rows, drafts);
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0]).toMatchObject({ dayId: 'monday', settings: { zoomPercent: 220 } });
  });

  it('duplicating a split copies every background as new rows that reuse the same images', () => {
    const source = [stored('monday', mondayPath, { zoomPercent: 150 }), stored('saturday', `${USER}/${PROFILE}/backgrounds/sat.webp`, { blurPx: 3 })];
    const plan = planBackgroundChanges([], draftsFromStored(source)); // new split: nothing stored yet
    expect(plan.upserts.map((change) => [change.dayId, change.image.storagePath, change.settings.zoomPercent, change.settings.blurPx])).toEqual([
      ['monday', mondayPath, 150, 0],
      ['saturday', `${USER}/${PROFILE}/backgrounds/sat.webp`, 100, 3],
    ]);
  });

  it('maps split background rows defensively', () => {
    const row: SplitBackgroundRow = { id: 'r', split_id: SPLIT, day_id: 'monday', storage_path: mondayPath, dim_percent: 60, blur_px: 2, zoom_percent: 175, focal_x: 30, focal_y: 40, updated_at: 't' };
    expect(toSplitBackground(row, 'https://signed')).toMatchObject({ dayId: 'monday', zoomPercent: 175, dimPercent: 60, imageUrl: 'https://signed' });
    expect(toSplitBackground({ ...row, day_id: 'funday' }, null)).toBeNull();
    expect(toSplitBackground({ ...row, storage_path: `${USER}/${PROFILE}/avatar.webp` }, null)).toBeNull();
  });
});

describe('background gallery (Phase 8b)', () => {
  const PROFILE_B = 'aaaaaaaa-0000-4000-8000-000000000002';
  const image = (id: string, uploaderProfileId: string | null, createdAt: string): BackgroundImage => ({
    id,
    uploaderProfileId,
    storagePath: `${USER}/${uploaderProfileId ?? 'splits'}/backgrounds/${id}.webp`,
    imageUrl: `https://signed/${id}`,
    createdAt,
  });
  const profiles = [
    { id: PROFILE, name: 'Bisss' },
    { id: PROFILE_B, name: 'Partner' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', name: 'Newbie' },
  ];

  it('groups images by uploader profile (newest first), hides profiles without uploads, and adds deleted-profile images last', () => {
    const groups = groupGalleryImages(
      [image('a1', PROFILE, '2026-11-01'), image('b1', PROFILE_B, '2026-11-02'), image('a2', PROFILE, '2026-11-03'), image('x', null, '2026-10-01'), image('y', 'gone-profile', '2026-10-02')],
      profiles,
    );
    expect(groups.map((group) => [group.label, group.images.map((i) => i.id)])).toEqual([
      ['Bisss', ['a2', 'a1']],
      ['Partner', ['b1']],
      ['A deleted profile', ['y', 'x']],
    ]);
  });

  it('an account without uploads has no groups', () => {
    expect(groupGalleryImages([], profiles)).toEqual([]);
  });

  it('duplicates are kept as separate cards (same picture, different uploads)', () => {
    const groups = groupGalleryImages([image('dup-1', PROFILE, '2026-11-01'), image('dup-2', PROFILE, '2026-11-01')], profiles);
    expect(groups[0].images.map((i) => i.id).sort()).toEqual(['dup-1', 'dup-2']);
  });

  it('only the uploading profile may delete (any profile for images of a deleted profile)', () => {
    expect(canDeleteBackgroundImage({ uploaderProfileId: PROFILE }, PROFILE)).toBe(true);
    expect(canDeleteBackgroundImage({ uploaderProfileId: PROFILE }, PROFILE_B)).toBe(false);
    expect(canDeleteBackgroundImage({ uploaderProfileId: null }, PROFILE_B)).toBe(true);
  });

  it('maps gallery rows', () => {
    const row: BackgroundImageRow = { id: 'g', owner_id: USER, uploader_profile_id: PROFILE, storage_path: `${USER}/${PROFILE}/backgrounds/a.webp`, created_at: '2026-11-24T10:00:00Z' };
    expect(toBackgroundImage(row, 'https://signed')).toEqual({ id: 'g', uploaderProfileId: PROFILE, storagePath: row.storage_path, imageUrl: 'https://signed', createdAt: row.created_at });
    expect(toBackgroundImage({ ...row, storage_path: `${USER}/${PROFILE}/avatar.webp` }, null)).toBeNull();
  });

  it('the settings summary exists only as an editor helper', () => {
    expect(backgroundSettingsSummary({ ...DEFAULT_CARD_BACKGROUND_SETTINGS, blurPx: 3, zoomPercent: 150 })).toBe('Background: custom image · dim 45% · blur 3px · zoom 150%');
  });
});

describe('split workouts: Copy Workouts and duplicate keep ALL / CUSTOM and empty selections', () => {
  const withMonday = (change: (day: CustomDayPlan) => CustomDayPlan): CustomDayPlan[] =>
    defaultCustomSchedule().map((day) => (day.dayId === 'monday' ? change({ ...day, isRest: false, muscleGroupIds: ['chest', 'back'] }) : day));

  it('copies an explicitly empty CUSTOM selection (no regions) and leaves ALL groups as ALL', () => {
    const days = withMonday((day) => setAllRegionsSelected(day, 'chest', false));
    const monday = days.find((day) => day.dayId === 'monday')!;
    expect(selectedRegionIds(monday, 'chest')).toEqual([]); // empty means NONE
    expect(selectedRegionIds(monday, 'back').length).toBeGreaterThan(0); // missing selection = ALL
    const copied = copyDayWorkout(days, 'monday', 'thursday');
    const thursday = copied.find((day) => day.dayId === 'thursday')!;
    expect(thursday.muscleGroupSelections).toEqual(monday.muscleGroupSelections);
    expect(selectedRegionIds(thursday, 'chest')).toEqual([]);
    expect(copied.find((day) => day.dayId === 'friday')).toEqual(days.find((day) => day.dayId === 'friday')); // others untouched
  });

  it('a duplicated schedule is independent of the original', () => {
    const original = withMonday((day) => setAllRegionsSelected(day, 'chest', false));
    const snapshot = JSON.stringify(original);
    const duplicate = cloneSchedule(original);
    const changed = duplicate.map((day) => (day.dayId === 'monday' ? setAllRegionsSelected(day, 'chest', true) : day));
    expect(JSON.stringify(changed)).not.toBe(snapshot);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

/* ---------- 6. Attendance / weight headings ---------- */
describe('weekly plan headings', () => {
  it('attendance heading follows all three states', () => {
    expect(attendanceHeading('ATTENDED')).toEqual({ text: 'Eeroju Vella 🥳', tone: 'success' });
    expect(attendanceHeading('MISSED')).toEqual({ text: 'Eeroju Vellala 😞', tone: 'danger' });
    expect(attendanceHeading(undefined)).toEqual({ text: 'Eeroju gym ki vellava?', tone: 'neutral' });
    expect(attendanceHeading(null)).toEqual({ text: 'Eeroju gym ki vellava?', tone: 'neutral' }); // cleared
  });
  it('weight heading and value', () => {
    expect(weightHeading(null)).toEqual({ text: 'Eeroju weight entha?', tone: 'neutral' });
    expect(weightHeading({ weightKg: 78.5 })).toEqual({ text: 'Eeroju weight', tone: 'success' });
    expect(formatTodayWeight(78.5, 'KG')).toBe('78.5 kg');
    expect(formatTodayWeight(78.5, 'LB')).toMatch(/^173(\.\d+)? lb$/);
  });
  it('Today page route round-trips', () => {
    expect(parseHash('#/profile/p1/today')).toEqual({ name: 'today', profileId: 'p1' });
    expect(routeToHash({ name: 'today', profileId: 'p1' })).toBe('#/profile/p1/today');
  });

  it('today’s data button: green when both are logged, yellow when one, red when none', () => {
    expect(todayLogStatus({ attendanceMarkable: true, attendance: 'ATTENDED', hasWeight: true })).toMatchObject({ label: 'Logged data', tone: 'success' });
    expect(todayLogStatus({ attendanceMarkable: true, attendance: 'MISSED', hasWeight: true })).toMatchObject({ label: 'Logged data', tone: 'success' }); // "did not go" is still logged
    expect(todayLogStatus({ attendanceMarkable: true, attendance: 'ATTENDED', hasWeight: false })).toMatchObject({ label: 'Logged partially!', tone: 'warning' });
    expect(todayLogStatus({ attendanceMarkable: true, attendance: undefined, hasWeight: true })).toMatchObject({ label: 'Logged partially!', tone: 'warning' });
    expect(todayLogStatus({ attendanceMarkable: true, attendance: null, hasWeight: false })).toMatchObject({ label: 'Log today’s data', tone: 'danger' });
    // Sunday / before tracking: only the weight counts
    expect(todayLogStatus({ attendanceMarkable: false, attendance: undefined, hasWeight: true })).toMatchObject({ tone: 'success', total: 1 });
    expect(todayLogStatus({ attendanceMarkable: false, attendance: undefined, hasWeight: false })).toMatchObject({ tone: 'danger', total: 1 });
  });

  it("today's entry uses the local calendar date key (late evening / just after midnight)", () => {
    const entries = new Map([
      ['2026-11-24', { date: '2026-11-24', weightKg: 80 }],
      ['2026-11-25', { date: '2026-11-25', weightKg: 79 }],
    ]);
    expect(toDateKey(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
    expect(toDateKey(new Date(2026, 10, 25, 0, 1))).toBe('2026-11-25');
    expect(todayWeightEntry(entries, toDateKey(new Date(2026, 10, 24, 23, 59)))?.weightKg).toBe(80);
    expect(todayWeightEntry(entries, toDateKey(new Date(2026, 10, 25, 0, 1)))?.weightKg).toBe(79);
    expect(todayWeightEntry(entries, '2026-11-26')).toBeNull();
  });
});

/* ---------- 7. Signed-URL reuse ---------- */
describe('image caching: signed-URL reuse', () => {
  const now = 1_800_000_000_000;
  const own = `${USER}/${PROFILE}/1.webp`;
  it('reuses a still-valid URL, so the browser cache can serve the image', () => {
    const raw = JSON.stringify({ [own]: { url: 'https://x/sign/1?token=a', expiresAt: now + 10 * 3600_000 } });
    const map = parseSignedUrlMap(raw, USER, now);
    expect(map[own].url).toBe('https://x/sign/1?token=a');
    expect(pathsNeedingSignature([own], map, now)).toEqual([]);
  });
  it('re-signs URLs that expired or expire within the margin', () => {
    const soon = { [own]: { url: 'https://x/a', expiresAt: now + SIGNED_URL_RENEW_MARGIN_MS - 1 } };
    expect(parseSignedUrlMap(JSON.stringify(soon), USER, now)).toEqual({});
    expect(pathsNeedingSignature([own], soon, now)).toEqual([own]);
    expect(pathsNeedingSignature([own], { [own]: { url: 'https://x/a', expiresAt: now - 1 } }, now)).toEqual([own]);
  });
  it('a replaced image has a new path, so it is never served stale', () => {
    const map = { [own]: { url: 'https://x/old', expiresAt: now + 20 * 3600_000 } };
    const replaced = `${USER}/${PROFILE}/2.webp`;
    expect(pathsNeedingSignature([replaced], map, now)).toEqual([replaced]);
    expect(pruneSignedUrlMap(map, [replaced])).toEqual({}); // the old one is forgotten
  });
  it("never keeps another account's paths and stores per user", () => {
    const raw = JSON.stringify({
      [own]: { url: 'https://x/mine', expiresAt: now + 20 * 3600_000 },
      [`${OTHER_USER}/p/1.webp`]: { url: 'https://x/theirs', expiresAt: now + 20 * 3600_000 },
      [`${USER}/bad`]: { url: 'javascript:alert(1)', expiresAt: now + 20 * 3600_000 },
    });
    expect(Object.keys(parseSignedUrlMap(raw, USER, now))).toEqual([own]);
    expect(signedUrlStorageKey(USER)).not.toBe(signedUrlStorageKey(OTHER_USER));
    expect(parseSignedUrlMap('not json', USER, now)).toEqual({});
  });
});

/* ---------- 8–11. Shared form videos ---------- */
describe('shared form videos', () => {
  const video = (id: string, createdAt: string, createdBy: string | null = USER): ExerciseFormVideo => ({
    id,
    createdBy,
    exerciseId: 't-bar-row-wide-grip',
    videoName: id,
    videoUrl: `https://www.youtube.com/watch?v=${id}`,
    platform: 'YOUTUBE',
    createdAt,
    updatedAt: createdAt,
  });
  it('maps the shared row with its creator', () => {
    const row: FormVideoRow = { id: 'v', created_by: OTHER_USER, exercise_id: 'e', video_name: 'Cue', video_url: 'https://a.com/v', platform: 'OTHER', created_at: 't', updated_at: 't' };
    expect(toFormVideo(row)).toMatchObject({ createdBy: OTHER_USER, exerciseId: 'e' });
    expect(toFormVideo({ ...row, created_by: null })?.createdBy).toBeNull();
  });
  it('hiding splits the list for the selected profile only; unhiding restores it', () => {
    const all = [video('b', '2026-11-02'), video('a', '2026-11-01'), video('c', '2026-11-03', OTHER_USER)];
    const forProfileA = splitVisibleVideos(all, new Set(['b']));
    expect(forProfileA.visible.map((v) => v.id)).toEqual(['a', 'c']);
    expect(forProfileA.hidden.map((v) => v.id)).toEqual(['b']);
    expect(splitVisibleVideos(all, new Set()).visible.map((v) => v.id)).toEqual(['a', 'b', 'c']); // another profile / unhidden
  });
  it('edit and delete warnings say they affect everyone', () => {
    expect(EDIT_SHARED_VIDEO_WARNING).toBe('Editing this form video will update it for all users and profiles. Are you sure you want to continue?');
    expect(DELETE_SHARED_VIDEO_WARNING).toBe('Deleting this form video will remove it for all users and profiles. Are you sure you want to continue?');
  });
});

/* ---------- Phase 8c: deleting images that are in use ---------- */
describe('pending file deletions (storage retry queue)', () => {
  const own = `${USER}/${PROFILE}/backgrounds/bg-1.webp`;
  it('keeps only unique background paths inside the user’s own folder', () => {
    const raw = JSON.stringify([own, own, `${OTHER_USER}/x/backgrounds/y.webp`, `${USER}/${PROFILE}/avatar.webp`, 42, null]);
    expect(parsePendingFileDeletes(raw, USER)).toEqual([own]);
  });
  it('ignores broken or missing data', () => {
    expect(parsePendingFileDeletes(null, USER)).toEqual([]);
    expect(parsePendingFileDeletes('not json', USER)).toEqual([]);
    expect(parsePendingFileDeletes('{"a":1}', USER)).toEqual([]);
  });
  it('is stored per user', () => {
    expect(pendingFileDeletesKey(USER)).not.toBe(pendingFileDeletesKey(OTHER_USER));
  });
});
