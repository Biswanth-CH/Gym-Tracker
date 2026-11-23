import { useCallback, useSyncExternalStore } from 'react';
import type { WeightUnit } from '../types/gym';

/**
 * The viewer's kg / lb choice for body-weight screens (graph, Weight Data calendar).
 * A per-device display preference only — weights are always stored in kg in Supabase.
 */
const STORAGE_KEY = 'gymtrack-body-weight-unit';
const listeners = new Set<() => void>();

function readUnit(): WeightUnit {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'LB' ? 'LB' : 'KG';
  } catch {
    return 'KG';
  }
}

let currentUnit: WeightUnit = typeof window === 'undefined' ? 'KG' : readUnit();

export function useWeightUnitPreference(): [WeightUnit, (unit: WeightUnit) => void] {
  const unit = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentUnit,
  );
  const setUnit = useCallback((next: WeightUnit) => {
    currentUnit = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [unit, setUnit];
}
