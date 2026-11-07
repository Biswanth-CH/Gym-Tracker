import { useCallback, useEffect, useState } from 'react';
import { isDayId } from '../constants/workoutSchedule';
import type { ExerciseCategory, Route } from '../types/gym';

/**
 * Minimal hash-based router. Hash URLs (#/profile/123) need no server
 * rewrites, so they work on GitHub Pages, survive refresh and support
 * the browser / phone back button.
 *
 *   #/
 *   #/profile/<id>
 *   #/profile/<id>/consistency
 *   #/profile/<id>/overview
 *   #/profile/<id>/day/<day>
 *   #/profile/<id>/day/<day>/muscle/<muscle>
 *   #/profile/<id>/day/<day>/muscle/<muscle>/region/<region>[/alternatives]
 *   #/profile/<id>/day/<day>/muscle/<muscle>/region/<region>/exercise/<exercise>
 */

const CATEGORY_SEGMENT: Record<ExerciseCategory, string> = { MACHINE: 'machines', ALTERNATIVE: 'alternatives' };

export function parseHash(hash: string): Route {
  const s = hash
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

  if (s[0] !== 'profile' || !s[1]) return { name: 'profiles' };
  const profileId = s[1];

  if (s[2] === 'consistency') return { name: 'consistency', profileId };
  if (s[2] === 'overview') return { name: 'overview', profileId };
  if (s[2] !== 'day' || !s[3] || !isDayId(s[3])) return { name: 'dashboard', profileId };
  const dayId = s[3];

  if (s[4] !== 'muscle' || !s[5]) return { name: 'day', profileId, dayId };
  const muscleId = s[5];

  if (s[6] !== 'region' || !s[7]) return { name: 'muscle', profileId, dayId, muscleId };
  const regionId = s[7];

  if (s[8] === 'exercise' && s[9]) {
    return { name: 'exercise', profileId, dayId, muscleId, regionId, exerciseId: s[9] };
  }
  return {
    name: 'region',
    profileId,
    dayId,
    muscleId,
    regionId,
    category: s[8] === CATEGORY_SEGMENT.ALTERNATIVE ? 'ALTERNATIVE' : 'MACHINE',
  };
}

const enc = encodeURIComponent;

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'profiles':
      return '#/';
    case 'dashboard':
      return `#/profile/${enc(route.profileId)}`;
    case 'consistency':
      return `#/profile/${enc(route.profileId)}/consistency`;
    case 'overview':
      return `#/profile/${enc(route.profileId)}/overview`;
    case 'day':
      return `#/profile/${enc(route.profileId)}/day/${route.dayId}`;
    case 'muscle':
      return `#/profile/${enc(route.profileId)}/day/${route.dayId}/muscle/${enc(route.muscleId)}`;
    case 'region': {
      const base = `#/profile/${enc(route.profileId)}/day/${route.dayId}/muscle/${enc(route.muscleId)}/region/${enc(route.regionId)}`;
      return route.category === 'ALTERNATIVE' ? `${base}/${CATEGORY_SEGMENT.ALTERNATIVE}` : base;
    }
    case 'exercise':
      return `#/profile/${enc(route.profileId)}/day/${route.dayId}/muscle/${enc(route.muscleId)}/region/${enc(
        route.regionId,
      )}/exercise/${enc(route.exerciseId)}`;
  }
}

export interface NavigateOptions {
  /** Replace the current history entry (e.g. switching tabs) instead of pushing a new one. */
  replace?: boolean;
}

let preserveScrollOnNextChange = false;

export function useHashRoute(): [Route, (route: Route, options?: NavigateOptions) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
      if (!preserveScrollOnNextChange) window.scrollTo({ top: 0 });
      preserveScrollOnNextChange = false;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route, options: NavigateOptions = {}) => {
    const hash = routeToHash(next);
    if (options.replace) {
      preserveScrollOnNextChange = true;
      window.location.replace(`${window.location.pathname}${window.location.search}${hash}`);
    } else {
      window.location.hash = hash;
    }
  }, []);

  return [route, navigate];
}
