import type { ProfileThemeKey } from '../types/gym';
import { deriveThemePalette, normalizeHexColor, themePaletteCssVariables } from '../utils/themeColor';

/**
 * Applies a profile theme to the whole document (`<html data-theme="…">`).
 *  - base theme: the open profile's saved theme (none on the Profiles page → neutral default),
 *  - preview theme: what Edit Profile is showing before Save (cleared on Cancel / close).
 * Presets come from the CSS theme block; a custom colour (Phase 7) is turned into the same
 * CSS variables by `deriveThemePalette`. Nothing is stored here; the saved theme comes from Supabase.
 */
export interface ProfileThemeChoice {
  themeKey: ProfileThemeKey;
  /** Exact #RRGGBB, or null to use the preset. */
  customThemeColor: string | null;
}

const CUSTOM_VARIABLES = ['--color-brand', '--color-brand-hover', '--color-brand-ink', '--color-brand-rgb'];

let baseTheme: ProfileThemeChoice | null = null;
let previewTheme: ProfileThemeChoice | null = null;

function applyDocumentTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = previewTheme ?? baseTheme;
  CUSTOM_VARIABLES.forEach((variable) => root.style.removeProperty(variable));
  if (!theme) {
    delete root.dataset.theme;
    return;
  }
  const customColor = normalizeHexColor(theme.customThemeColor);
  if (customColor) {
    root.dataset.theme = 'custom';
    Object.entries(themePaletteCssVariables(deriveThemePalette(customColor))).forEach(([variable, value]) => root.style.setProperty(variable, value));
  } else {
    root.dataset.theme = theme.themeKey;
  }
}

export function setBaseTheme(theme: ProfileThemeChoice | null): void {
  baseTheme = theme;
  applyDocumentTheme();
}

export function setPreviewTheme(theme: ProfileThemeChoice | null): void {
  previewTheme = theme;
  applyDocumentTheme();
}

/** Inline style for one profile tile (subtle accent in that profile's own colour). */
export function profileTileThemeStyle(customThemeColor: string | null): Record<string, string> | undefined {
  const customColor = normalizeHexColor(customThemeColor);
  return customColor ? themePaletteCssVariables(deriveThemePalette(customColor)) : undefined;
}
