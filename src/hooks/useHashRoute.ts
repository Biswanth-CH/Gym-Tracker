import { useCallback, useEffect, useState } from 'react';
import { isDayId } from '../constants/workoutSchedule';
import type { Route } from '../types/gym';

/**
 * Minimal hash-based router. Hash URLs (#/profile/123) need no server
 * rewrites, so they work on GitHub Pages, survive refresh and support
 * the browser / phone back button.
 */
export function parseHash(hash: string): Route {
  const segments = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (segments[0] === 'profile' && segments[1]) {
    const profileId = segments[1];
    const dayId = segments[3];
    if (segments[2] === 'day' && dayId && isDayId(dayId)) {
      return { name: 'day', profileId, dayId };
    }
    return { name: 'dashboard', profileId };
  }
  return { name: 'profiles' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'profiles':
      return '#/';
    case 'dashboard':
      return `#/profile/${encodeURIComponent(route.profileId)}`;
    case 'day':
      return `#/profile/${encodeURIComponent(route.profileId)}/day/${route.dayId}`;
  }
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = routeToHash(next);
  }, []);

  return [route, navigate];
}
