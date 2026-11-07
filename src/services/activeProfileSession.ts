import { LAST_PROFILE_KEY } from '../constants/storageKeys';

/**
 * The profile the user last opened in this tab (sessionStorage, never synced).
 * Cleared on logout so the next account starts on the Profiles page.
 */

export function rememberActiveProfile(profileId: string): void {
  try {
    window.sessionStorage.setItem(LAST_PROFILE_KEY, profileId);
  } catch {
    // Private mode can block session storage. Navigation still works from the current route.
  }
}

export function rememberedActiveProfileId(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_PROFILE_KEY);
  } catch {
    return null;
  }
}

/** Forgets the active profile and resets the route to the Profiles page (`#/`). */
export function clearActiveProfileSelection(): void {
  try {
    window.sessionStorage.removeItem(LAST_PROFILE_KEY);
  } catch {
    // Nothing stored.
  }
  if (window.location.hash && window.location.hash !== '#/') {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  }
}
