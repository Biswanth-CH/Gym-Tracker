import type { CSSProperties } from 'react';
import type { CardBackgroundKey, CardBackgroundSettings } from '../types/gym';

/**
 * Card background images (Phase 7). Pure helpers shared by the profile tile, the weekly
 * day cards and the editor preview. Limits match the CHECK constraints in
 * `profile_card_backgrounds`.
 */

export const DEFAULT_CARD_BACKGROUND_SETTINGS: CardBackgroundSettings = { dimPercent: 45, blurPx: 0, focalX: 50, focalY: 50 };
export const MAX_DIM_PERCENT = 90;
export const MAX_BLUR_PX = 20;
/** Uploads are compressed to stay under the private bucket's 1 MB file limit. */
export const MAX_BACKGROUND_BYTES = 950 * 1024;
export const MAX_BACKGROUND_DIMENSION = 1600;

const CARD_KEYS = new Set<string>(['profile', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

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
    focalX: clampInt(value.focalX, 0, 100, DEFAULT_CARD_BACKGROUND_SETTINGS.focalX),
    focalY: clampInt(value.focalY, 0, 100, DEFAULT_CARD_BACKGROUND_SETTINGS.focalY),
  };
}

/**
 * Styles for the two background layers. Blur goes ONLY on the image layer (slightly
 * scaled so blurred edges never show); the overlay sits between image and content.
 */
export function backgroundLayerStyles(imageUrl: string, settings: CardBackgroundSettings): { image: CSSProperties; overlay: CSSProperties } {
  const safe = normalizeBackgroundSettings(settings);
  return {
    image: {
      // Signed URLs never contain quotes or backslashes; strip them anyway so the CSS url() can't break out.
      backgroundImage: `url("${imageUrl.replace(/["\\]/g, '')}")`,
      backgroundPosition: `${safe.focalX}% ${safe.focalY}%`,
      filter: safe.blurPx > 0 ? `blur(${safe.blurPx}px)` : undefined,
      transform: safe.blurPx > 0 ? `scale(${1 + Math.min(0.15, safe.blurPx / 100)})` : undefined,
    },
    overlay: { opacity: safe.dimPercent / 100 },
  };
}

/** `<user>/<profile>/backgrounds/<card>-<time>.<ext>` — the folder the database policy requires. */
export function cardBackgroundPath(userId: string, profileId: string, cardKey: CardBackgroundKey, mimeType: string, timestamp = Date.now()): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  return `${userId}/${profileId}/backgrounds/${cardKey}-${timestamp}.${extension}`;
}
