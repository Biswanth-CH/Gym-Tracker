import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabaseClient';
import { errorMessage } from '../services/cloud/cloudErrors';
import { fetchAllRows } from '../services/cloud/db';
import { fetchLockedProfileIds } from '../services/cloud/profileLockQueries';
import { SIGNED_URL_TTL_SECONDS, signProfilePhotos } from '../services/cloud/profilePhotoService';
import {
  CLOUD_TABLES,
  type AttendanceRow,
  type CloudTable,
  type ProfileRow,
  type BodyWeightRow,
  type RecordRow,
  type SelectionRow,
  type SplitTemplateRow,
  type TemplateRow,
  type TrackerRow,
  type WorkoutPlanRow,
} from '../services/cloud/rows';
import { addDays, toDateKey } from '../utils/dateUtils';

/**
 * In-memory mirror of the signed-in account's cloud data.
 *
 * Supabase is the single source of truth:
 *  - everything is loaded after sign-in,
 *  - every successful write is applied here immediately,
 *  - Realtime change events (any device) trigger a re-read of that table,
 *  - focus / reconnect trigger a full re-read to catch anything missed.
 * Nothing here is persisted locally, so two writable stores can never diverge.
 */

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface CloudSnapshot {
  phase: 'signed-out' | 'loading' | 'ready' | 'error';
  error: string | null;
  connection: ConnectionState;
  syncing: boolean;
  lastSyncedAt: number | null;
  userId: string | null;
  profiles: ProfileRow[];
  attendance: AttendanceRow[];
  selections: SelectionRow[];
  templates: TemplateRow[];
  trackers: TrackerRow[];
  records: RecordRow[];
  workoutPlans: WorkoutPlanRow[];
  bodyWeights: BodyWeightRow[];
  splitTemplates: SplitTemplateRow[];
  /** PIN-locked profile ids (from list_locked_profiles(); never hashes). */
  lockedProfileIds: string[];
  /** storage path → signed URL */
  photoUrls: Record<string, string>;
}

type RowsByTable = {
  gym_profiles: ProfileRow;
  attendance_records: AttendanceRow;
  daily_exercise_selections: SelectionRow;
  exercise_set_templates: TemplateRow;
  daily_set_tracker_states: TrackerRow;
  exercise_personal_records: RecordRow;
  profile_workout_plans: WorkoutPlanRow;
  body_weight_entries: BodyWeightRow;
  account_workout_split_templates: SplitTemplateRow;
};

const SLICE: { [T in CloudTable]: keyof CloudSnapshot } = {
  gym_profiles: 'profiles',
  attendance_records: 'attendance',
  daily_exercise_selections: 'selections',
  exercise_set_templates: 'templates',
  daily_set_tracker_states: 'trackers',
  exercise_personal_records: 'records',
  profile_workout_plans: 'workoutPlans',
  body_weight_entries: 'bodyWeights',
  account_workout_split_templates: 'splitTemplates',
};

const INITIAL: CloudSnapshot = {
  phase: 'signed-out',
  error: null,
  connection: 'connecting',
  syncing: false,
  lastSyncedAt: null,
  userId: null,
  profiles: [],
  attendance: [],
  selections: [],
  templates: [],
  trackers: [],
  records: [],
  workoutPlans: [],
  bodyWeights: [],
  splitTemplates: [],
  lockedProfileIds: [],
  photoUrls: {},
};

let state: CloudSnapshot = INITIAL;
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let generation = 0;
let retryTimer: number | undefined;
let retryAttempt = 0;
let photoTimer: number | undefined;
let lastFullRefresh = 0;
const pendingTables = new Map<CloudTable, number>();

function setState(patch: Partial<CloudSnapshot>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export const cloudStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): CloudSnapshot {
    return state;
  },

  /** Begin syncing for a signed-in user (idempotent per user). */
  async start(userId: string): Promise<void> {
    if (state.userId === userId && state.phase !== 'signed-out') return;
    stopInternal();
    const myGeneration = ++generation;
    setState({ ...INITIAL, phase: 'loading', userId });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    photoTimer = window.setInterval(() => void refreshPhotoUrls(true), (SIGNED_URL_TTL_SECONDS - 300) * 1000);
    subscribeRealtime(myGeneration);
    await cloudStore.refreshAll();
  },

  stop(): void {
    stopInternal();
    generation += 1;
    setState(INITIAL);
  },

  /** Re-reads every table (initial load, focus, reconnect, manual retry). */
  async refreshAll(): Promise<void> {
    const myGeneration = generation;
    if (!state.userId) return;
    lastFullRefresh = Date.now();
    setState({ syncing: true });
    try {
      // Locks load together with the data so a locked profile never renders before its lock is known.
      const [results, lockedProfileIds] = await Promise.all([
        Promise.all(CLOUD_TABLES.map((table) => loadTableOrEmpty(table))),
        fetchLockedProfileIds().catch(() => null),
      ]);
      if (myGeneration !== generation) return;
      const patch: Partial<CloudSnapshot> = {};
      CLOUD_TABLES.forEach((table, index) => {
        (patch as Record<string, unknown>)[SLICE[table]] = results[index];
      });
      if (lockedProfileIds) patch.lockedProfileIds = lockedProfileIds;
      setState({ ...patch, phase: 'ready', error: null, syncing: false, lastSyncedAt: Date.now() });
      await refreshPhotoUrls(false);
    } catch (error) {
      if (myGeneration !== generation) return;
      setState({
        syncing: false,
        error: errorMessage(error, 'Could not load your data.'),
        phase: state.phase === 'ready' ? 'ready' : 'error',
      });
    }
  },

  /** Re-reads one table (debounced; used for Realtime events). */
  refreshTable(table: CloudTable): void {
    window.clearTimeout(pendingTables.get(table));
    pendingTables.set(
      table,
      window.setTimeout(() => {
        pendingTables.delete(table);
        const myGeneration = generation;
        loadTableOrEmpty(table)
          .then(async (rows) => {
            if (myGeneration !== generation) return;
            setState({ [SLICE[table]]: rows, lastSyncedAt: Date.now() } as Partial<CloudSnapshot>);
            // PIN set / removed bumps the profile row, so re-read locks with profiles.
            if (table === 'gym_profiles') await Promise.all([refreshPhotoUrls(false), cloudStore.refreshLockedProfiles()]);
          })
          .catch((error) => setState({ error: errorMessage(error, 'Sync failed.') }));
      }, 150),
    );
  },

  /** Applies rows returned by a successful write (insert / update / upsert). */
  applyUpserts<T extends CloudTable>(table: T, rows: RowsByTable[T][]): void {
    const slice = state[SLICE[table]] as unknown as RowsByTable[T][];
    const byId = new Map(slice.map((row) => [row.id, row]));
    rows.forEach((row) => byId.set(row.id, row));
    setState({ [SLICE[table]]: [...byId.values()] } as Partial<CloudSnapshot>);
    if (table === 'gym_profiles') void refreshPhotoUrls(false);
  },

  /** Removes rows locally after a successful delete. */
  applyDeletes<T extends CloudTable>(table: T, predicate: (row: RowsByTable[T]) => boolean): void {
    const slice = state[SLICE[table]] as unknown as RowsByTable[T][];
    setState({ [SLICE[table]]: slice.filter((row) => !predicate(row)) } as Partial<CloudSnapshot>);
  },

  /** Removes a profile and its children locally (the database cascades the real delete). */
  applyProfileDeleted(profileId: string): void {
    setState({
      profiles: state.profiles.filter((row) => row.id !== profileId),
      attendance: state.attendance.filter((row) => row.profile_id !== profileId),
      selections: state.selections.filter((row) => row.profile_id !== profileId),
      templates: state.templates.filter((row) => row.profile_id !== profileId),
      trackers: state.trackers.filter((row) => row.profile_id !== profileId),
      records: state.records.filter((row) => row.profile_id !== profileId),
      workoutPlans: state.workoutPlans.filter((row) => row.profile_id !== profileId),
      bodyWeights: state.bodyWeights.filter((row) => row.profile_id !== profileId),
    });
  },

  /** Re-reads which profiles are PIN locked. Keeps the last known list if the request fails. */
  async refreshLockedProfiles(): Promise<void> {
    const myGeneration = generation;
    if (!state.userId) return;
    try {
      const lockedProfileIds = await fetchLockedProfileIds();
      if (myGeneration === generation) setState({ lockedProfileIds });
    } catch {
      // Offline or transient error: the next refresh retries.
    }
  },

  clearError(): void {
    setState({ error: null });
  },
};

function loadTable(table: CloudTable): Promise<unknown[]> {
  // Daily tracker rows only matter for today; skip older days to keep loads small.
  if (table === 'daily_set_tracker_states') {
    return fetchAllRows(table, [{ column: 'date', op: 'gte', value: toDateKey(addDays(new Date(), -1)) }]);
  }
  return fetchAllRows(table);
}

const OPTIONAL_TABLES = new Set<CloudTable>(['profile_workout_plans', 'body_weight_entries', 'account_workout_split_templates']);

/** Newer tables may not exist until the Phase 4 / Phase 6 SQL migrations are applied. */
function isMissingOptionalTable(table: CloudTable, error: unknown): boolean {
  if (!OPTIONAL_TABLES.has(table) || typeof error !== 'object' || error === null) return false;
  const details = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof details.code === 'string' ? details.code : '';
  const message = typeof details.message === 'string' ? details.message : '';
  return code === 'PGRST205' || code === '42P01' || details.status === 404 || /schema cache|does not exist|could not find the table/i.test(message);
}

async function loadTableOrEmpty(table: CloudTable): Promise<unknown[]> {
  try {
    return await loadTable(table);
  } catch (error) {
    if (isMissingOptionalTable(table, error)) return [];
    throw error;
  }
}

async function refreshPhotoUrls(forceAll: boolean): Promise<void> {
  const paths = state.profiles.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const missing = forceAll ? paths : paths.filter((path) => !state.photoUrls[path]);
  if (missing.length === 0) return;
  try {
    const signed = await signProfilePhotos(missing);
    const keep = Object.fromEntries(Object.entries(state.photoUrls).filter(([path]) => paths.includes(path)));
    setState({ photoUrls: { ...keep, ...signed } });
  } catch {
    // Photos fall back to initials; the next refresh will retry.
  }
}

function subscribeRealtime(myGeneration: number): void {
  const supabase = getSupabase();
  if (channel) void supabase.removeChannel(channel);
  setState({ connection: retryAttempt > 0 ? 'reconnecting' : 'connecting' });

  let next = supabase.channel(`gymtrack-sync-${state.userId}-${myGeneration}-${retryAttempt}`);
  for (const table of CLOUD_TABLES) {
    next = next.on('postgres_changes', { event: '*', schema: 'public', table }, () => cloudStore.refreshTable(table));
  }
  channel = next;
  channel.subscribe((status) => {
    if (myGeneration !== generation) return;
    if (status === 'SUBSCRIBED') {
      const wasDown = state.connection !== 'live' && retryAttempt > 0;
      retryAttempt = 0;
      setState({ connection: 'live' });
      if (wasDown) void cloudStore.refreshAll(); // catch up on anything missed while disconnected
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      scheduleResubscribe(myGeneration);
    }
  });
}

function scheduleResubscribe(myGeneration: number): void {
  window.clearTimeout(retryTimer);
  retryAttempt += 1;
  setState({ connection: navigator.onLine === false ? 'offline' : 'reconnecting' });
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryAttempt, 5));
  retryTimer = window.setTimeout(() => {
    if (myGeneration === generation) subscribeRealtime(myGeneration);
  }, delay);
}

function onFocus(): void {
  if (document.visibilityState === 'hidden') return;
  if (Date.now() - lastFullRefresh < 3000) return;
  void cloudStore.refreshAll();
}

function onOnline(): void {
  const myGeneration = generation;
  void cloudStore.refreshAll();
  if (state.connection !== 'live') subscribeRealtime(myGeneration);
}

function onOffline(): void {
  setState({ connection: 'offline' });
}

function stopInternal(): void {
  window.removeEventListener('focus', onFocus);
  document.removeEventListener('visibilitychange', onFocus);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  window.clearTimeout(retryTimer);
  window.clearInterval(photoTimer);
  pendingTables.forEach((timer) => window.clearTimeout(timer));
  pendingTables.clear();
  retryAttempt = 0;
  if (channel) {
    try {
      void getSupabase().removeChannel(channel);
    } catch {
      // Client unavailable — nothing to unsubscribe.
    }
    channel = null;
  }
}
