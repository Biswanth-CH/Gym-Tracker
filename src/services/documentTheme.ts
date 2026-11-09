import type { ProfileThemeKey } from '../types/gym';

/**
 * Applies a profile theme to the whole document (`<html data-theme="…">`).
 *  - base theme: the open profile's saved theme (none on the Profiles page → neutral default),
 *  - preview theme: what Edit Profile is showing before Save (cleared on Cancel / close).
 * Nothing is stored; the saved theme comes from Supabase.
 */
let baseThemeKey: ProfileThemeKey | null = null;
let previewThemeKey: ProfileThemeKey | null = null;

function applyDocumentTheme(): void {
  if (typeof document === 'undefined') return;
  const themeKey = previewThemeKey ?? baseThemeKey;
  if (themeKey) document.documentElement.dataset.theme = themeKey;
  else delete document.documentElement.dataset.theme;
}

export function setBaseTheme(themeKey: ProfileThemeKey | null): void {
  baseThemeKey = themeKey;
  applyDocumentTheme();
}

export function setPreviewTheme(themeKey: ProfileThemeKey | null): void {
  previewThemeKey = themeKey;
  applyDocumentTheme();
}
