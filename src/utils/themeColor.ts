/**
 * Custom profile colours (Phase 7). One place turns a user's exact HEX into the theme
 * tokens the whole app already uses (--color-brand, --color-brand-hover, --color-brand-ink,
 * --color-brand-rgb). The stored value is always the user's exact choice; the derived
 * palette only adjusts lightness when needed so text and focus rings stay readable on
 * GymTrack's dark surfaces (WCAG AA, 4.5:1).
 */

export interface ThemePalette {
  brand: string;
  brandHover: string;
  /** Text on top of the brand colour (buttons, badges). */
  brandInk: string;
  /** "r, g, b" for rgba(var(--color-brand-rgb), alpha) tints. */
  brandRgb: string;
  /** True when the chosen colour was lightened for readability. */
  adjusted: boolean;
}

type Rgb = [number, number, number];

/** The lightest dark surface the brand colour sits on (--color-surface-raised). */
const DARK_SURFACE: Rgb = [0x1b, 0x1f, 0x26];
const DARK_INK = '#0b0d10';
const LIGHT_INK = '#ffffff';
export const MIN_CONTRAST = 4.5;

/** "#4f46e5" / "4F46E5" → "#4F46E5"; anything else → null. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : null;
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === rn ? (gn - bn) / delta + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hueToChannel = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToChannel(p, q, h + 1 / 3) * 255, hueToChannel(p, q, h) * 255, hueToChannel(p, q, h - 1 / 3) * 255];
}

function withLightness(hex: string, lightness: number): string {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, s, Math.min(1, Math.max(0, lightness))]));
}

/** Derives a readable palette from any HEX colour (very dark, very light, grey, neon…). */
export function deriveThemePalette(hexColor: string): ThemePalette {
  const base = normalizeHexColor(hexColor) ?? '#C6F432';
  const surface = rgbToHex(DARK_SURFACE);
  let brand = base;
  let lightness = rgbToHsl(hexToRgb(base))[2];
  // Lighten (same hue and saturation) until the colour reads on the dark surfaces.
  while (contrastRatio(brand, surface) < MIN_CONTRAST && lightness < 1) {
    lightness = Math.min(1, lightness + 0.02);
    brand = withLightness(base, lightness);
  }
  const hoverLightness = lightness <= 0.88 ? lightness + 0.08 : lightness - 0.08;
  const brandHover = withLightness(brand, hoverLightness);
  const brandInk = contrastRatio(brand, DARK_INK) >= contrastRatio(brand, LIGHT_INK) ? DARK_INK : LIGHT_INK;
  const [r, g, b] = hexToRgb(brand);
  return { brand, brandHover, brandInk, brandRgb: `${r}, ${g}, ${b}`, adjusted: brand !== base };
}

/** CSS custom properties for a custom colour (applied to <html> or a single profile tile). */
export function themePaletteCssVariables(palette: ThemePalette): Record<string, string> {
  return {
    '--color-brand': palette.brand,
    '--color-brand-hover': palette.brandHover,
    '--color-brand-ink': palette.brandInk,
    '--color-brand-rgb': palette.brandRgb,
  };
}
