import type { ProfileThemeKey } from '../types/gym';

/**
 * Profile colour themes. The colour VALUES live in one place — the "Profile themes"
 * block in index.css (`[data-theme='…']` sets --color-brand, --color-brand-rgb, …).
 * Components never hard-code palette colours; they use those tokens.
 * Keys match the `gym_profiles_theme_key_check` constraint.
 */
export interface ProfileThemeOption {
  key: ProfileThemeKey;
  label: string;
  description: string;
}

export const PROFILE_THEMES: readonly ProfileThemeOption[] = [
  { key: 'lime', label: 'Lime', description: 'GymTrack classic' },
  { key: 'blue', label: 'Blue', description: 'Ocean' },
  { key: 'purple', label: 'Purple', description: 'Violet' },
  { key: 'crimson', label: 'Crimson', description: 'Red' },
  { key: 'amber', label: 'Amber', description: 'Orange' },
  { key: 'teal', label: 'Teal', description: 'Aqua' },
  { key: 'rose', label: 'Rose', description: 'Pink' },
  { key: 'slate', label: 'Slate', description: 'Neutral' },
];

export const DEFAULT_PROFILE_THEME: ProfileThemeKey = 'lime';

const THEME_KEYS = new Set<string>(PROFILE_THEMES.map((theme) => theme.key));

export function isProfileThemeKey(value: unknown): value is ProfileThemeKey {
  return typeof value === 'string' && THEME_KEYS.has(value);
}

export function getProfileTheme(key: ProfileThemeKey): ProfileThemeOption {
  return PROFILE_THEMES.find((theme) => theme.key === key) ?? PROFILE_THEMES[0];
}
