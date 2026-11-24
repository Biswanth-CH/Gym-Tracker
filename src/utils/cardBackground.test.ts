import { describe, expect, it } from 'vitest';
import { toCardBackground, type CardBackgroundRow } from '../services/cloud/rows';
import { copyDayWorkout, defaultCustomSchedule } from './workoutPlan';
import {
  DEFAULT_CARD_BACKGROUND_SETTINGS,
  backgroundLayerStyles,
  cardBackgroundPath,
  isCardBackgroundKey,
  normalizeBackgroundSettings,
} from './cardBackground';
import { fitWithin } from './imageUtils';

const USER = '11111111-1111-4111-8111-111111111111';
const PROFILE = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('card background settings', () => {
  it('defaults to a sensible dim and no blur, centred', () => {
    expect(DEFAULT_CARD_BACKGROUND_SETTINGS).toEqual({ dimPercent: 45, blurPx: 0, zoomPercent: 100, focalX: 50, focalY: 50 });
  });

  it('clamps and rounds every value to the database limits', () => {
    expect(normalizeBackgroundSettings({ dimPercent: '120', blurPx: -3, focalX: 33.6, focalY: 'x' })).toEqual({ dimPercent: 90, blurPx: 0, zoomPercent: 100, focalX: 34, focalY: 50 });
    expect(normalizeBackgroundSettings({ blurPx: 99 }).blurPx).toBe(20);
  });

  it('puts blur on the image layer only and dim on the overlay', () => {
    const styles = backgroundLayerStyles('https://x.supabase.co/storage/v1/object/sign/a.webp?token=t', { dimPercent: 60, blurPx: 8, zoomPercent: 100, focalX: 20, focalY: 80 });
    expect(styles.image.filter).toBe('blur(8px)');
    expect(styles.image.backgroundPosition).toBe('20% 80%');
    expect(styles.image.transform).toMatch(/scale/);
    expect(styles.overlay).toEqual({ opacity: 0.6 });
    expect(styles.overlay).not.toHaveProperty('filter');
    const sharp = backgroundLayerStyles('https://x/a.webp', DEFAULT_CARD_BACKGROUND_SETTINGS);
    expect(sharp.image.filter).toBeUndefined();
    expect(backgroundLayerStyles('https://x/a".webp', DEFAULT_CARD_BACKGROUND_SETTINGS).image.backgroundImage).toBe('url("https://x/a.webp")');
  });

  it('builds paths inside the profile\'s own backgrounds folder (as the database policy requires)', () => {
    const path = cardBackgroundPath(USER, PROFILE, 'monday', 'image/webp', 1700000000000);
    expect(path).toBe(`${USER}/${PROFILE}/backgrounds/monday-1700000000000.webp`);
    expect(path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/backgrounds\/[A-Za-z0-9._-]{1,120}$/);
    expect(cardBackgroundPath(USER, PROFILE, 'profile', 'image/jpeg', 1)).toMatch(/profile-1\.jpg$/);
  });

  it('accepts only profile and weekday card keys', () => {
    expect(['profile', 'monday', 'sunday'].every(isCardBackgroundKey)).toBe(true);
    expect(isCardBackgroundKey('funday')).toBe(false);
  });

  it('maps rows defensively', () => {
    const row: CardBackgroundRow = { id: 'b', profile_id: PROFILE, card_key: 'thursday', storage_path: `${USER}/${PROFILE}/backgrounds/t.webp`, dim_percent: 70, blur_px: 4, focal_x: 10, focal_y: 90, updated_at: 't' };
    expect(toCardBackground(row, 'https://signed')).toMatchObject({ cardKey: 'thursday', dimPercent: 70, blurPx: 4, focalX: 10, focalY: 90, imageUrl: 'https://signed' });
    expect(toCardBackground({ ...row, card_key: 'nope' }, null)).toBeNull();
    expect(toCardBackground({ ...row, storage_path: `${USER}/${PROFILE}/avatar.webp` }, null)).toBeNull();
  });

  it('resizes large images to fit without enlarging small ones', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('copying a workout day never carries a background (backgrounds are not in the split JSON)', () => {
    const copied = copyDayWorkout(defaultCustomSchedule(), 'monday', 'thursday');
    expect(JSON.stringify(copied)).not.toMatch(/background|storage_path|dim|blur/i);
  });
});
