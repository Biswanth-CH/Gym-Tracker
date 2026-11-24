import type { CSSProperties } from 'react';
import type { CardBackgroundKey, CardBackgroundSettings, DayId } from '../types/gym';

/**
 * Card background images (Phase 7). Pure helpers shared by the profile tile, the weekly
 * day cards and the editor preview. Limits match the CHECK constraints in
 * `profile_card_backgrounds`.
 */

export const DEFAULT_CARD_BACKGROUND_SETTINGS: CardBackgroundSettings = { dimPercent: 45, blurPx: 0, zoomPercent: 100, focalX: 50, focalY: 50 };
export const MAX_DIM_PERCENT = 90;
export const MAX_BLUR_PX = 20;
/** 100 % = the image exactly covers the card (never smaller, so it never leaves gaps). */
export const MIN_ZOOM_PERCENT = 100;
export const MAX_ZOOM_PERCENT = 300;
/** Uploads are compressed to stay under the private bucket's 1 MB file limit. */
export const MAX_BACKGROUND_BYTES = 950 * 1024;
export const MAX_BACKGROUND_DIMENSION = 1600;

const DAY_IDS = new Set<string>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const CARD_KEYS = new Set<string>(['profile', ...DAY_IDS]);

export function isDayId(value: unknown): value is DayId {
  return typeof value === 'string' && DAY_IDS.has(value);
}

export function isCardBackgroundKey(value: unknown): value is CardBackgroundKey {
  return typeof value === 'string' && CARD_KEYS.has(value);
}

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

/** Accepts anything (row values, slider strings) and returns valid, whole-number settings. */
export function normalizeBackgroundSettings(value: Partial<Record<keyof CardBackgroundSettings, unknown>>): CardBackgroundSettings {
  return {
    dimPercent: clampInt(value.dimPercent, 0, MAX_DIM_PERCENT, DEFAULT_CARD_BACKGROUND_SETTINGS.dimPercent),
    blurPx: clampInt(value.blurPx, 0, MAX_BLUR_PX, DEFAULT_CARD_BACKGROUND_SETTINGS.blurPx),
    zoomPercent: clampInt(value.zoomPercent, MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT, DEFAULT_CARD_BACKGROUND_SETTINGS.zoomPercent),
    focalX: clampInt(value.focalX, 0, 100, DEFAULT_CARD_BACKGROUND_SETTINGS.focalX),
    focalY: clampInt(value.focalY, 0, 100, DEFAULT_CARD_BACKGROUND_SETTINGS.focalY),
  };
}

/**
 * Styles for the two background layers. Blur goes ONLY on the image layer (slightly
 * scaled so blurred edges never show); the overlay sits between image and content.
 * Zoom scales the image layer around the focal point: the layer is `background-size:
 * cover`, so at 100 % the image already covers the card without stretching, and any
 * zoom ≥ 100 % keeps covering it (aspect ratio is never changed).
 */
export function backgroundLayerStyles(imageUrl: string, settings: CardBackgroundSettings): { image: CSSProperties; overlay: CSSProperties } {
  const safe = normalizeBackgroundSettings(settings);
  return {
    image: {
      // Signed URLs never contain quotes or backslashes; strip them anyway so the CSS url() can't break out.
      backgroundImage: `url("${imageUrl.replace(/["\\]/g, '')}")`,
      backgroundPosition: `${safe.focalX}% ${safe.focalY}%`,
      filter: safe.blurPx > 0 ? `blur(${safe.blurPx}px)` : undefined,
      transform: imageScale(safe) === 1 ? undefined : `scale(${imageScale(safe)})`,
      transformOrigin: `${safe.focalX}% ${safe.focalY}%`,
    },
    overlay: { opacity: safe.dimPercent / 100 },
  };
}

/** "Background: custom image · dim 45% · blur 0px · zoom 100%" — shown only inside Edit Background. */
export function backgroundSettingsSummary(settings: CardBackgroundSettings): string {
  const safe = normalizeBackgroundSettings(settings);
  return `Background: custom image · dim ${safe.dimPercent}% · blur ${safe.blurPx}px · zoom ${safe.zoomPercent}%`;
}

/** Zoom × the small extra scale that hides blurred edges. Exported for tests. */
export function imageScale(settings: CardBackgroundSettings): number {
  const blurScale = settings.blurPx > 0 ? 1 + Math.min(0.15, settings.blurPx / 100) : 1;
  return Math.round((settings.zoomPercent / 100) * blurScale * 1000) / 1000;
}

const extensionFor = (mimeType: string) => (mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp');

/** `<user>/<profile>/backgrounds/bg-<time>-<random>.<ext>` — a gallery upload by that profile (Phase 8b). */
export function galleryImagePath(userId: string, profileId: string, mimeType: string, timestamp = Date.now(), random = Math.random().toString(36).slice(2, 8)): string {
  return `${userId}/${profileId}/backgrounds/bg-${timestamp}-${random.replace(/[^a-z0-9]/gi, '')}.${extensionFor(mimeType)}`;
}

/** `<user>/<profile>/backgrounds/<card>-<time>.<ext>` — the folder the database policy requires. */
export function cardBackgroundPath(userId: string, profileId: string, cardKey: CardBackgroundKey, mimeType: string, timestamp = Date.now()): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  return `${userId}/${profileId}/backgrounds/${cardKey}-${timestamp}.${extension}`;
}
