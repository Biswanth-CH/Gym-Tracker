import { getExercisesForRegion } from '../constants/exerciseLibrary';
import { MUSCLE_GROUPS_BY_ID, isMuscleGroupId } from '../constants/muscleGroups';
import type { CustomDayPlan, MuscleGroupId, MuscleGroupSelection, RegionSelection, SelectionMode, WorkoutDay } from '../types/gym';

/**
 * Three-level workout selection: Muscle Group → Target Region → Exercise Variation.
 *
 * Rules (mandatory, also for legacy data):
 *  - A selected group with no stored selection selects ALL its regions and ALL their exercises.
 *  - A selected region with no stored exercise selection selects ALL exercises mapped to it.
 *  - CUSTOM stores exactly the chosen ids; CUSTOM with an empty list means NONE.
 * Exercises come from the library's explicit `targets` mapping (`getExercisesForRegion`),
 * never from secondary-muscle text.
 */

type DaySelectionSource = Pick<CustomDayPlan, 'muscleGroupIds' | 'isRest' | 'muscleGroupSelections'>;

/* ---------- Library lookups (stable ids only) ---------- */

export function regionIdsOfMuscleGroup(muscleGroupId: MuscleGroupId): string[] {
  return MUSCLE_GROUPS_BY_ID[muscleGroupId].regions.map((region) => region.id);
}

/** Every exercise variation mapped to a region (machines and alternatives). */
export function exerciseIdsOfRegion(regionId: string): string[] {
  return getExercisesForRegion(regionId).map((exercise) => exercise.id);
}

function isRegionOfGroup(muscleGroupId: MuscleGroupId, regionId: string): boolean {
  return regionIdsOfMuscleGroup(muscleGroupId).includes(regionId);
}

/* ---------- Reading the effective selection ---------- */

export function muscleGroupSelectionOf(day: DaySelectionSource, muscleGroupId: MuscleGroupId): MuscleGroupSelection {
  const stored = day.muscleGroupSelections?.find((selection) => selection.muscleGroupId === muscleGroupId);
  return stored ?? { muscleGroupId, regionSelectionMode: 'ALL', regions: [] };
}

export function isMuscleGroupSelected(day: DaySelectionSource, muscleGroupId: MuscleGroupId): boolean {
  return !day.isRest && day.muscleGroupIds.includes(muscleGroupId);
}

/** Selected target regions of a group, in library order. */
export function selectedRegionIds(day: DaySelectionSource, muscleGroupId: MuscleGroupId): string[] {
  if (!isMuscleGroupSelected(day, muscleGroupId)) return [];
  const selection = muscleGroupSelectionOf(day, muscleGroupId);
  const allRegionIds = regionIdsOfMuscleGroup(muscleGroupId);
  if (selection.regionSelectionMode === 'ALL') return allRegionIds;
  const chosen = new Set(selection.regions.map((region) => region.regionId));
  return allRegionIds.filter((regionId) => chosen.has(regionId));
}

function regionSelectionOf(selection: MuscleGroupSelection, regionId: string): RegionSelection {
  return (
    selection.regions.find((region) => region.regionId === regionId) ?? {
      regionId,
      exerciseSelectionMode: 'ALL',
      exerciseIds: [],
    }
  );
}

/** Selected exercise variations of a region (empty when the region itself is not selected). */
export function selectedExerciseIds(day: DaySelectionSource, muscleGroupId: MuscleGroupId, regionId: string): string[] {
  if (!selectedRegionIds(day, muscleGroupId).includes(regionId)) return [];
  const regionSelection = regionSelectionOf(muscleGroupSelectionOf(day, muscleGroupId), regionId);
  const allExerciseIds = exerciseIdsOfRegion(regionId);
  if (regionSelection.exerciseSelectionMode === 'ALL') return allExerciseIds;
  const chosen = new Set(regionSelection.exerciseIds);
  // Library order; ids that no longer exist in the library are simply not shown.
  return allExerciseIds.filter((exerciseId) => chosen.has(exerciseId));
}

export interface SelectionSummary {
  selectedRegionCount: number;
  totalRegionCount: number;
  selectedExerciseCount: number;
  totalExerciseCount: number;
}

export function summarizeMuscleGroupSelection(day: DaySelectionSource, muscleGroupId: MuscleGroupId): SelectionSummary {
  const allRegionIds = regionIdsOfMuscleGroup(muscleGroupId);
  const regionIds = selectedRegionIds(day, muscleGroupId);
  return {
    selectedRegionCount: regionIds.length,
    totalRegionCount: allRegionIds.length,
    selectedExerciseCount: regionIds.reduce((count, regionId) => count + selectedExerciseIds(day, muscleGroupId, regionId).length, 0),
    totalExerciseCount: allRegionIds.reduce((count, regionId) => count + exerciseIdsOfRegion(regionId).length, 0),
  };
}

/* ---------- Editing (pure: each returns a new day) ---------- */

function withGroupSelection<T extends CustomDayPlan>(day: T, next: MuscleGroupSelection | null, muscleGroupId: MuscleGroupId): T {
  const others = (day.muscleGroupSelections ?? []).filter((selection) => selection.muscleGroupId !== muscleGroupId);
  const selections = next ? [...others, next] : others;
  return { ...day, muscleGroupSelections: selections };
}

/** Collapses equivalent forms so ALL stays ALL (and JSON stays small and backward compatible). */
function normalizeGroupSelection(selection: MuscleGroupSelection): MuscleGroupSelection | null {
  const allRegionIds = regionIdsOfMuscleGroup(selection.muscleGroupId);
  // Canonical form: known regions only, in library order (stable JSON whatever the click order).
  const regions = selection.regions
    .filter((region) => allRegionIds.includes(region.regionId))
    .sort((a, b) => allRegionIds.indexOf(a.regionId) - allRegionIds.indexOf(b.regionId))
    .map((region) => normalizeRegionSelection(region));
  if (selection.regionSelectionMode === 'CUSTOM' && allRegionIds.every((regionId) => regions.some((region) => region.regionId === regionId))) {
    // Every region chosen individually → ALL (keeping any narrowed exercise lists).
    return normalizeGroupSelection({ ...selection, regionSelectionMode: 'ALL', regions });
  }
  if (selection.regionSelectionMode === 'ALL') {
    const overrides = regions.filter((region) => region.exerciseSelectionMode === 'CUSTOM');
    return overrides.length === 0 ? null : { ...selection, regions: overrides };
  }
  return { ...selection, regions };
}

function normalizeRegionSelection(region: RegionSelection): RegionSelection {
  if (region.exerciseSelectionMode === 'ALL') return { regionId: region.regionId, exerciseSelectionMode: 'ALL', exerciseIds: [] };
  const allExerciseIds = exerciseIdsOfRegion(region.regionId);
  const unique = [...new Set(region.exerciseIds)];
  if (allExerciseIds.length > 0 && allExerciseIds.every((exerciseId) => unique.includes(exerciseId))) {
    return { regionId: region.regionId, exerciseSelectionMode: 'ALL', exerciseIds: [] };
  }
  return { regionId: region.regionId, exerciseSelectionMode: 'CUSTOM', exerciseIds: unique };
}

function storeGroupSelection<T extends CustomDayPlan>(day: T, selection: MuscleGroupSelection): T {
  return withGroupSelection(day, normalizeGroupSelection(selection), selection.muscleGroupId);
}

/** Level 1. Selecting a group starts with ALL regions and ALL exercises; deselecting drops its child selections. */
export function setMuscleGroupSelected<T extends CustomDayPlan>(day: T, muscleGroupId: MuscleGroupId, selected: boolean): T {
  if (day.isRest) return day;
  const without = withGroupSelection(day, null, muscleGroupId);
  const muscleGroupIds = day.muscleGroupIds.filter((id) => id !== muscleGroupId);
  return { ...without, muscleGroupIds: selected ? [...muscleGroupIds, muscleGroupId] : muscleGroupIds };
}

/** Level 2 bulk: Select All Regions resets to ALL (regions and exercises); Deselect All stores an explicit empty list. */
export function setAllRegionsSelected<T extends CustomDayPlan>(day: T, muscleGroupId: MuscleGroupId, selected: boolean): T {
  const base = isMuscleGroupSelected(day, muscleGroupId) ? day : setMuscleGroupSelected(day, muscleGroupId, true);
  if (selected) return withGroupSelection(base, null, muscleGroupId);
  return withGroupSelection(base, { muscleGroupId, regionSelectionMode: 'CUSTOM', regions: [] }, muscleGroupId);
}

/** Level 2 single region. Adding a region starts with ALL its exercises; other choices are kept. */
export function setRegionSelected<T extends CustomDayPlan>(day: T, muscleGroupId: MuscleGroupId, regionId: string, selected: boolean): T {
  if (!isRegionOfGroup(muscleGroupId, regionId)) return day;
  const base = isMuscleGroupSelected(day, muscleGroupId) ? day : setMuscleGroupSelected(day, muscleGroupId, true);
  const current = muscleGroupSelectionOf(base, muscleGroupId);
  const selectedIds = selectedRegionIds(base, muscleGroupId);
  const keep = selected ? [...new Set([...selectedIds, regionId])] : selectedIds.filter((id) => id !== regionId);
  const regions = keep.map((id) => (id === regionId && selected ? regionSelectionOf({ ...current, regions: [] }, id) : regionSelectionOf(current, id)));
  return storeGroupSelection(base, { muscleGroupId, regionSelectionMode: 'CUSTOM', regions });
}

/** Level 3 bulk: Select All Exercises → ALL; Deselect All Exercises → explicit empty CUSTOM list. Selects the region if needed. */
export function setAllExercisesSelected<T extends CustomDayPlan>(day: T, muscleGroupId: MuscleGroupId, regionId: string, selected: boolean): T {
  const base = selectedRegionIds(day, muscleGroupId).includes(regionId) ? day : setRegionSelected(day, muscleGroupId, regionId, true);
  const current = muscleGroupSelectionOf(base, muscleGroupId);
  const nextRegion: RegionSelection = selected
    ? { regionId, exerciseSelectionMode: 'ALL', exerciseIds: [] }
    : { regionId, exerciseSelectionMode: 'CUSTOM', exerciseIds: [] };
  const regions = [...current.regions.filter((region) => region.regionId !== regionId), nextRegion];
  return storeGroupSelection(base, { ...current, regions });
}

/** Level 3 single exercise. Other explicit choices are preserved; choosing every exercise again restores ALL. */
export function setExerciseSelected<T extends CustomDayPlan>(
  day: T,
  muscleGroupId: MuscleGroupId,
  regionId: string,
  exerciseId: string,
  selected: boolean,
): T {
  if (!exerciseIdsOfRegion(regionId).includes(exerciseId)) return day;
  const base = selectedRegionIds(day, muscleGroupId).includes(regionId) ? day : setAllExercisesSelected(day, muscleGroupId, regionId, false);
  const current = muscleGroupSelectionOf(base, muscleGroupId);
  const chosen = selectedExerciseIds(base, muscleGroupId, regionId);
  const exerciseIds = selected ? [...new Set([...chosen, exerciseId])] : chosen.filter((id) => id !== exerciseId);
  const regions = [
    ...current.regions.filter((region) => region.regionId !== regionId),
    { regionId, exerciseSelectionMode: 'CUSTOM' as const, exerciseIds },
  ];
  return storeGroupSelection(base, { ...current, regions });
}

/* ---------- Parsing / normalising stored JSON ---------- */

const isSelectionMode = (value: unknown): value is SelectionMode => value === 'ALL' || value === 'CUSTOM';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads `muscleGroupSelections` from stored JSON defensively. Unknown groups / regions are
 * dropped; an unreadable mode falls back to ALL (never NONE). Exercise ids are kept as stored.
 */
export function parseMuscleGroupSelections(value: unknown, muscleGroupIds: readonly MuscleGroupId[]): MuscleGroupSelection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const selections: MuscleGroupSelection[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.muscleGroupId !== 'string') continue;
    const candidateGroupId: string = entry.muscleGroupId;
    if (!isMuscleGroupId(candidateGroupId) || !muscleGroupIds.includes(candidateGroupId)) continue;
    if (selections.some((selection) => selection.muscleGroupId === candidateGroupId)) continue;
    const muscleGroupId: MuscleGroupId = candidateGroupId;
    const regionSelectionMode: SelectionMode = isSelectionMode(entry.regionSelectionMode) ? entry.regionSelectionMode : 'ALL';
    const regions: RegionSelection[] = [];
    for (const regionEntry of Array.isArray(entry.regions) ? entry.regions : []) {
      if (!isRecord(regionEntry) || typeof regionEntry.regionId !== 'string') continue;
      const regionId: string = regionEntry.regionId;
      if (!isRegionOfGroup(muscleGroupId, regionId) || regions.some((region) => region.regionId === regionId)) continue;
      const exerciseSelectionMode: SelectionMode = isSelectionMode(regionEntry.exerciseSelectionMode) ? regionEntry.exerciseSelectionMode : 'ALL';
      const exerciseIds = Array.isArray(regionEntry.exerciseIds)
        ? [...new Set(regionEntry.exerciseIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100))]
        : [];
      regions.push({ regionId, exerciseSelectionMode, exerciseIds: exerciseSelectionMode === 'CUSTOM' ? exerciseIds : [] });
    }
    selections.push({ muscleGroupId, regionSelectionMode, regions });
  }
  return selections.length > 0 ? selections : undefined;
}

/** Before saving: keep only selections of selected groups, in compact canonical form. */
export function normalizeDaySelections<T extends CustomDayPlan>(day: T): T {
  if (day.isRest) {
    const { muscleGroupSelections: _ignored, ...rest } = day;
    void _ignored;
    return rest as T;
  }
  const selections = (day.muscleGroupSelections ?? [])
    .filter((selection) => day.muscleGroupIds.includes(selection.muscleGroupId))
    .map(normalizeGroupSelection)
    .filter((selection): selection is MuscleGroupSelection => selection !== null);
  if (selections.length === 0) {
    const { muscleGroupSelections: _ignored, ...rest } = day;
    void _ignored;
    return rest as T;
  }
  return { ...day, muscleGroupSelections: selections };
}

/* ---------- Workout day helpers (day pages and route guards) ---------- */

/** Adapts a resolved weekly-plan day (built-in PPL or custom) to the selection readers. */
export function daySelectionSource(day: Pick<WorkoutDay, 'muscleGroupIds' | 'muscleGroupSelections'>): DaySelectionSource {
  return { muscleGroupIds: day.muscleGroupIds, isRest: day.muscleGroupIds.length === 0, muscleGroupSelections: day.muscleGroupSelections };
}

/** Selected exercise ids per selected region of one group on a workout day. */
export function allowedExerciseIdsByRegion(
  day: Pick<WorkoutDay, 'muscleGroupIds' | 'muscleGroupSelections'>,
  muscleGroupId: MuscleGroupId,
): Map<string, ReadonlySet<string>> {
  const source = daySelectionSource(day);
  return new Map(selectedRegionIds(source, muscleGroupId).map((regionId) => [regionId, new Set(selectedExerciseIds(source, muscleGroupId, regionId))]));
}
