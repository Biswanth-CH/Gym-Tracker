import { EXERCISES_BY_ID } from '../../constants/exerciseLibrary';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { getSupabase } from '../../lib/supabaseClient';
import type { AttendanceStatus, DateKey, LocalProfile, PersonalRecordInput, SetPlan } from '../../types/gym';
import { isoToLocalDateKey, isValidDateKey, toDateKey } from '../../utils/dateUtils';
import { computePersonalRecords } from '../../utils/personalRecords';
import { normalizeName } from '../../utils/profileUtils';
import { convertWeight } from '../../utils/workoutUtils';
import { getAttendanceRecords } from '../attendanceStorageService';
import { getPreferencesForProfile } from '../exerciseStorageService';
import { getProfiles as getLocalProfiles } from '../profileStorageService';
import { getAllLogsForProfile } from '../workoutStorageService';
import { CloudError, ensureOk, toCloudError } from './cloudErrors';
import { dataUrlToBlob, uploadProfilePhoto } from './profilePhotoService';
import type { ProfileRow } from './rows';

/**
 * One-time, idempotent import of the original LocalStorage data into Supabase.
 *
 * Safety rules
 *  - Local data is NEVER deleted or modified; a backup copy is kept locally
 *    (`gym-tracker-backup-before-cloud`) and in the cloud (`local_data_backups`).
 *  - Existing cloud data is never overwritten: every write is an upsert that
 *    ignores duplicates, and photos are only added where none exist.
 *  - Re-running is safe: profile ids are preserved (or derived deterministically),
 *    so repeated imports update nothing and create no duplicates.
 *  - Results are verified against the original data before completion is recorded.
 */

export const LOCAL_BACKUP_KEY = 'gym-tracker-backup-before-cloud';
const MARKER_PREFIX = 'gym-tracker-cloud-migration:';
const IMPORT_NOTE = 'Imported from this device’s GymTrack history';
const BATCH = 500;

export interface LocalSnapshot {
  profiles: LocalProfile[];
  attendance: Record<string, Array<{ date: DateKey; status: AttendanceStatus }>>;
  plans: Record<string, Array<{ exerciseId: string; plan: SetPlan }>>;
  records: Record<string, Array<{ exerciseId: string; input: PersonalRecordInput }>>;
  workoutSessions: number;
  raw: Record<string, string | null>;
}

export interface ProfilePlanItem {
  local: LocalProfile;
  targetId: string;
  action: 'create' | 'already-imported' | 'merge-by-name';
  targetName: string;
}

export interface MigrationCounts {
  profiles: number;
  newProfiles: number;
  mergedProfiles: number;
  photos: number;
  attendance: number;
  plans: number;
  records: number;
  workoutSessions: number;
}

export interface MigrationPlan {
  items: ProfilePlanItem[];
  counts: MigrationCounts;
  cloudHasData: boolean;
}

export type MigrationStepId = 'backup' | 'profiles' | 'photos' | 'attendance' | 'plans' | 'records' | 'verify';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export const MIGRATION_STEPS: ReadonlyArray<{ id: MigrationStepId; label: string }> = [
  { id: 'backup', label: 'Back up the original data' },
  { id: 'profiles', label: 'Import profiles' },
  { id: 'photos', label: 'Upload profile pictures' },
  { id: 'attendance', label: 'Import attendance' },
  { id: 'plans', label: 'Create set plans from working weights' },
  { id: 'records', label: 'Import personal records' },
  { id: 'verify', label: 'Verify the imported data' },
];

export interface VerificationReport {
  profiles: number;
  attendance: number;
  plans: number;
  records: number;
  photos: number;
  keptCloudValues: number;
}

export interface MigrationMarker {
  status: 'completed' | 'dismissed';
  at: string;
  report?: VerificationReport;
}

/* ---------------- Local snapshot ---------------- */

const RAW_KEYS = [STORAGE_KEYS.profiles, STORAGE_KEYS.attendance, STORAGE_KEYS.workoutLogs, STORAGE_KEYS.exercisePreferences];

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function hasLocalProfiles(): boolean {
  try {
    return getLocalProfiles().length > 0;
  } catch {
    return false;
  }
}

/** Reads (never modifies) the original browser data. Returns null when there is nothing to import. */
export function readLocalSnapshot(): LocalSnapshot | null {
  const profiles = getLocalProfiles();
  if (profiles.length === 0) return null;
  const snapshot: LocalSnapshot = { profiles, attendance: {}, plans: {}, records: {}, workoutSessions: 0, raw: {} };
  RAW_KEYS.forEach((key) => (snapshot.raw[key] = readRaw(key)));

  for (const profile of profiles) {
    snapshot.attendance[profile.id] = getAttendanceRecords(profile.id)
      .filter((record) => isValidDateKey(record.date))
      .map((record) => ({ date: record.date, status: record.status }));

    const logs = getAllLogsForProfile(profile.id);
    const prefs = getPreferencesForProfile(profile.id);
    snapshot.workoutSessions += [...logs.values()].reduce((sum, list) => sum + list.length, 0);

    const exerciseIds = new Set([...logs.keys(), ...Object.keys(prefs)]);
    const plans: LocalSnapshot['plans'][string] = [];
    const records: LocalSnapshot['records'][string] = [];
    for (const exerciseId of exerciseIds) {
      const exercise = EXERCISES_BY_ID.get(exerciseId);
      if (!exercise) continue;
      const exerciseLogs = logs.get(exerciseId) ?? [];
      const pref = prefs[exerciseId];
      const latest = exerciseLogs[0];

      if ((pref && pref.workingWeight !== null) || latest) {
        const unit = pref?.weightUnit ?? latest?.sets[0]?.weightUnit ?? 'KG';
        const count = Math.min(10, Math.max(1, latest?.sets.length ?? 3));
        const defaultReps = exercise.measure === 'SECONDS' ? exercise.recommendedRepRange.max : 12;
        plans.push({
          exerciseId,
          plan: {
            unit,
            sets: Array.from({ length: count }, (_, index) => {
              const logged = latest?.sets[index];
              let weight: number | null = null;
              if (exercise.loadType !== 'BAND') {
                if (pref && pref.workingWeight !== null) weight = convertWeight(pref.workingWeight, pref.workingWeightUnit, unit);
                else if (logged && logged.weight !== null) weight = convertWeight(logged.weight, logged.weightUnit, unit);
              }
              const reps = logged?.repetitions && logged.repetitions > 0 ? logged.repetitions : defaultReps;
              return { weight, reps };
            }),
          },
        });
      }

      const best = computePersonalRecords(exerciseLogs, exercise).bestSet;
      if (best) {
        records.push({
          exerciseId,
          input: {
            recordDate: best.date,
            weight: exercise.loadType === 'BAND' ? null : best.weight,
            unit: best.weightUnit,
            reps: best.repetitions,
            sets: null,
            notes: IMPORT_NOTE,
          },
        });
      }
    }
    snapshot.plans[profile.id] = plans;
    snapshot.records[profile.id] = records;
  }
  return snapshot;
}

/* ---------------- Markers (per account, per device) ---------------- */

export function getMigrationMarker(userId: string): MigrationMarker | null {
  try {
    const raw = window.localStorage.getItem(MARKER_PREFIX + userId);
    return raw ? (JSON.parse(raw) as MigrationMarker) : null;
  } catch {
    return null;
  }
}

export function setMigrationMarker(userId: string, marker: MigrationMarker): void {
  try {
    window.localStorage.setItem(MARKER_PREFIX + userId, JSON.stringify(marker));
  } catch {
    // Non-fatal: the import is idempotent, so offering it again is harmless.
  }
}

export function clearMigrationMarker(userId: string): void {
  try {
    window.localStorage.removeItem(MARKER_PREFIX + userId);
  } catch {
    // ignore
  }
}

/* ---------------- Plan ---------------- */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Stable UUID for a local id that is not a UUID (or collides with another account). */
export async function deriveProfileUuid(userId: string, localId: string): Promise<string> {
  const hex = await sha256Hex(`gymtrack:${userId}:${localId}`);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function buildMigrationPlan(snapshot: LocalSnapshot, cloudProfiles: readonly ProfileRow[], userId: string): Promise<MigrationPlan> {
  const items: ProfilePlanItem[] = [];
  for (const local of snapshot.profiles) {
    const derived = await deriveProfileUuid(userId, local.id);
    const preferred = UUID_PATTERN.test(local.id) ? local.id : derived;
    const sameId = cloudProfiles.find((row) => row.id === preferred || row.id === derived);
    const sameName = cloudProfiles.find((row) => row.name.toLowerCase() === normalizeName(local.name).toLowerCase());
    if (sameId) items.push({ local, targetId: sameId.id, action: 'already-imported', targetName: sameId.name });
    else if (sameName) items.push({ local, targetId: sameName.id, action: 'merge-by-name', targetName: sameName.name });
    else items.push({ local, targetId: preferred, action: 'create', targetName: normalizeName(local.name) });
  }
  const sum = (record: Record<string, unknown[]>) => Object.values(record).reduce((total, list) => total + list.length, 0);
  return {
    items,
    cloudHasData: cloudProfiles.length > 0,
    counts: {
      profiles: items.length,
      newProfiles: items.filter((item) => item.action === 'create').length,
      mergedProfiles: items.filter((item) => item.action !== 'create').length,
      photos: snapshot.profiles.filter((profile) => profile.photoDataUrl).length,
      attendance: sum(snapshot.attendance),
      plans: sum(snapshot.plans),
      records: sum(snapshot.records),
      workoutSessions: snapshot.workoutSessions,
    },
  };
}

/* ---------------- Run ---------------- */

async function insertIgnoringDuplicates(table: string, rows: Record<string, unknown>[], onConflict: string, label: string): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH) {
    const chunk = rows.slice(start, start + BATCH);
    ensureOk(await getSupabase().from(table).upsert(chunk, { onConflict, ignoreDuplicates: true }), `Could not import ${label}.`);
  }
}

async function selectByProfiles<T>(table: string, profileIds: string[]): Promise<T[]> {
  if (profileIds.length === 0) return [];
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = ensureOk(
      await getSupabase().from(table).select('*').in(table === 'gym_profiles' ? 'id' : 'profile_id', profileIds).order('id').range(from, from + 999),
      `Could not verify ${table.replace(/_/g, ' ')}.`,
    ) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function runMigration(
  plan: MigrationPlan,
  snapshot: LocalSnapshot,
  userId: string,
  onStep: (step: MigrationStepId, status: StepStatus, detail?: string) => void,
): Promise<VerificationReport> {
  const supabase = getSupabase();
  const run = async <T>(step: MigrationStepId, task: () => Promise<T>): Promise<T> => {
    onStep(step, 'running');
    try {
      const result = await task();
      onStep(step, 'done');
      return result;
    } catch (error) {
      const cloudError = toCloudError(error, `Step “${MIGRATION_STEPS.find((s) => s.id === step)?.label}” failed.`);
      onStep(step, 'failed', cloudError.message);
      throw cloudError;
    }
  };

  // Map local profile id → cloud profile id (may change if a preserved id is unavailable).
  const target = new Map(plan.items.map((item) => [item.local.id, item.targetId]));

  await run('backup', async () => {
    try {
      if (!window.localStorage.getItem(LOCAL_BACKUP_KEY)) {
        window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({ createdAt: new Date().toISOString(), data: snapshot.raw }));
      }
    } catch {
      // Storage full: the cloud backup below still protects the data.
    }
    const payload = { createdAt: new Date().toISOString(), data: snapshot.raw };
    const fingerprint = await sha256Hex(JSON.stringify(snapshot.raw));
    ensureOk(
      await supabase.from('local_data_backups').upsert({ owner_id: userId, fingerprint, payload }, { onConflict: 'owner_id,fingerprint', ignoreDuplicates: true }),
      'Could not store the backup copy.',
    );
  });

  await run('profiles', async () => {
    for (const item of plan.items) {
      if (item.action !== 'create') continue;
      const local = item.local;
      const row = {
        owner_id: userId,
        name: item.targetName,
        gender: local.gender,
        tracking_start_date: isoToLocalDateKey(local.createdAt) ?? toDateKey(new Date()),
        created_at: local.createdAt,
        updated_at: local.updatedAt,
      };
      for (const candidate of [item.targetId, await deriveProfileUuid(userId, local.id)]) {
        ensureOk(await supabase.from('gym_profiles').upsert({ ...row, id: candidate }, { onConflict: 'id', ignoreDuplicates: true }), `Could not import profile “${local.name}”.`);
        const visible = ensureOk(await supabase.from('gym_profiles').select('id').eq('id', candidate), 'Could not verify the profile.') as Array<{ id: string }>;
        if (visible.length > 0) {
          target.set(local.id, candidate);
          break;
        }
        // Preserved id already used elsewhere (e.g. another account on this device) → fall back to the derived id.
      }
      if (!target.has(local.id) || !(await profileVisible(target.get(local.id) as string))) {
        throw new CloudError(`Profile “${local.name}” could not be imported.`, 'unknown');
      }
    }
  });

  await run('photos', async () => {
    for (const local of snapshot.profiles) {
      if (!local.photoDataUrl) continue;
      const profileId = target.get(local.id) as string;
      const rows = ensureOk(await supabase.from('gym_profiles').select('id, photo_path').eq('id', profileId), 'Could not read the profile.') as Array<{ photo_path: string | null }>;
      if (rows[0]?.photo_path) continue; // never replace a photo that already exists in the cloud
      const path = await uploadProfilePhoto(userId, profileId, dataUrlToBlob(local.photoDataUrl), 'imported');
      ensureOk(await supabase.from('gym_profiles').update({ photo_path: path }).eq('id', profileId), 'Could not link the profile picture.');
    }
  });

  await run('attendance', async () => {
    const rows = snapshot.profiles.flatMap((local) =>
      (snapshot.attendance[local.id] ?? []).map((record) => ({ profile_id: target.get(local.id), date: record.date, status: record.status })),
    );
    await insertIgnoringDuplicates('attendance_records', rows, 'profile_id,date', 'attendance');
  });

  await run('plans', async () => {
    const rows = snapshot.profiles.flatMap((local) =>
      (snapshot.plans[local.id] ?? []).map((entry) => ({ profile_id: target.get(local.id), exercise_id: entry.exerciseId, set_configuration: entry.plan })),
    );
    await insertIgnoringDuplicates('exercise_set_templates', rows, 'profile_id,exercise_id', 'set plans');
  });

  await run('records', async () => {
    const rows = snapshot.profiles.flatMap((local) =>
      (snapshot.records[local.id] ?? []).map((entry) => ({
        profile_id: target.get(local.id),
        exercise_id: entry.exerciseId,
        record_date: entry.input.recordDate,
        best_session: { weight: entry.input.weight, unit: entry.input.unit, reps: entry.input.reps, sets: entry.input.sets },
        notes: entry.input.notes,
      })),
    );
    await insertIgnoringDuplicates('exercise_personal_records', rows, 'profile_id,exercise_id', 'personal records');
  });

  const report = await run('verify', async () => {
    const ids = [...new Set(target.values())];
    const profiles = await selectByProfiles<{ id: string; photo_path: string | null }>('gym_profiles', ids);
    const attendance = await selectByProfiles<{ profile_id: string; date: string; status: string }>('attendance_records', ids);
    const plans = await selectByProfiles<{ profile_id: string; exercise_id: string }>('exercise_set_templates', ids);
    const records = await selectByProfiles<{ profile_id: string; exercise_id: string }>('exercise_personal_records', ids);

    const problems: string[] = [];
    let keptCloudValues = 0;
    for (const local of snapshot.profiles) {
      const id = target.get(local.id) as string;
      const cloudProfile = profiles.find((row) => row.id === id);
      if (!cloudProfile) {
        problems.push(`profile “${local.name}”`);
        continue;
      }
      if (local.photoDataUrl && !cloudProfile.photo_path) problems.push(`picture for “${local.name}”`);
      for (const record of snapshot.attendance[local.id] ?? []) {
        const match = attendance.find((row) => row.profile_id === id && row.date === record.date);
        if (!match) problems.push(`attendance ${record.date} for “${local.name}”`);
        else if (match.status !== record.status) keptCloudValues += 1;
      }
      for (const entry of snapshot.plans[local.id] ?? []) {
        if (!plans.some((row) => row.profile_id === id && row.exercise_id === entry.exerciseId)) problems.push(`set plan ${entry.exerciseId}`);
      }
      for (const entry of snapshot.records[local.id] ?? []) {
        if (!records.some((row) => row.profile_id === id && row.exercise_id === entry.exerciseId)) problems.push(`PR ${entry.exerciseId}`);
      }
    }
    if (problems.length > 0) {
      throw new CloudError(`Some items are missing in the cloud: ${problems.slice(0, 5).join(', ')}${problems.length > 5 ? '…' : ''}`, 'unknown');
    }
    return {
      profiles: profiles.length,
      attendance: attendance.length,
      plans: plans.length,
      records: records.length,
      photos: profiles.filter((row) => row.photo_path).length,
      keptCloudValues,
    } satisfies VerificationReport;
  });

  setMigrationMarker(userId, { status: 'completed', at: new Date().toISOString(), report });
  return report;
}

async function profileVisible(id: string): Promise<boolean> {
  const rows = ensureOk(await getSupabase().from('gym_profiles').select('id').eq('id', id), 'Could not verify the profile.') as Array<{ id: string }>;
  return rows.length > 0;
}
