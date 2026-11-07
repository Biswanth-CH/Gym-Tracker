import { STORAGE_KEYS } from '../constants/storageKeys';
import type { AttendanceMap, AttendanceRecord, AttendanceStatus, DateKey } from '../types/gym';
import { isSunday, isValidDateKey, parseDateKey, toDateKey } from '../utils/dateUtils';
import { readJson, subscribeToKey, writeJson } from './localStorageClient';

/**
 * Attendance persistence, stored separately from profiles under
 * `gym-tracker-attendance`, keyed by profile ID (never by name):
 *
 *   {
 *     "<profileId>": {
 *       "2026-11-03": { "status": "ATTENDED", "updatedAt": "2026-11-03T18:20:00.000Z" }
 *     }
 *   }
 *
 * Every write re-reads the whole store and only touches one profile's entry,
 * so other profiles' histories are never overwritten.
 */

interface StoredEntry {
  status: AttendanceStatus;
  updatedAt: string;
}

type ProfileAttendance = Record<DateKey, StoredEntry>;
type AttendanceStore = Record<string, ProfileAttendance>;

export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceValidationError';
  }
}

function isStatus(value: unknown): value is AttendanceStatus {
  return value === 'ATTENDED' || value === 'MISSED';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the store, dropping any malformed profile, date or entry individually. */
function readStore(): AttendanceStore {
  const result = readJson(STORAGE_KEYS.attendance);
  if (result.kind !== 'ok' || !isPlainObject(result.value)) {
    if (result.kind === 'ok') console.warn(`[GymTrack] Expected an object in "${STORAGE_KEYS.attendance}".`);
    return {};
  }

  const store: AttendanceStore = {};
  for (const [profileId, dates] of Object.entries(result.value)) {
    if (!isPlainObject(dates)) continue;
    const clean: ProfileAttendance = {};
    for (const [date, entry] of Object.entries(dates)) {
      if (!isValidDateKey(date) || !isPlainObject(entry) || !isStatus(entry.status)) continue;
      clean[date] = {
        status: entry.status,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date(0).toISOString(),
      };
    }
    store[profileId] = clean;
  }
  return store;
}

function writeStore(store: AttendanceStore): void {
  writeJson(STORAGE_KEYS.attendance, store);
}

/** Business rules: only real, past-or-today, non-Sunday dates can be marked. */
function assertMarkable(date: DateKey): void {
  if (!isValidDateKey(date)) throw new AttendanceValidationError('That is not a valid date.');
  const day = parseDateKey(date);
  if (isSunday(day)) throw new AttendanceValidationError('Sundays are rest days and can’t be marked.');
  if (date > toDateKey(new Date())) throw new AttendanceValidationError('Future dates can’t be marked yet.');
}

export function getAttendanceRecords(profileId: string): AttendanceRecord[] {
  const entries = readStore()[profileId] ?? {};
  return Object.entries(entries)
    .map(([date, entry]) => ({ profileId, date, status: entry.status, updatedAt: entry.updatedAt }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Convenience lookup used by the UI and the calculations. */
export function getAttendanceMap(profileId: string): AttendanceMap {
  const entries = readStore()[profileId] ?? {};
  return new Map(Object.entries(entries).map(([date, entry]) => [date, entry.status]));
}

export function getAttendanceByDate(profileId: string, date: DateKey): AttendanceRecord | null {
  const entry = readStore()[profileId]?.[date];
  return entry ? { profileId, date, status: entry.status, updatedAt: entry.updatedAt } : null;
}

/** Creates or replaces the mark for one date (re-marking edits it). */
export function markAttendance(profileId: string, date: DateKey, status: AttendanceStatus): AttendanceRecord {
  assertMarkable(date);
  if (!isStatus(status)) throw new AttendanceValidationError('Unknown attendance status.');

  const store = readStore();
  const updatedAt = new Date().toISOString();
  store[profileId] = { ...(store[profileId] ?? {}), [date]: { status, updatedAt } };
  writeStore(store);
  return { profileId, date, status, updatedAt };
}

/** Alias kept for API clarity: updating is the same upsert as marking. */
export const updateAttendance = markAttendance;

export function clearAttendance(profileId: string, date: DateKey): void {
  const store = readStore();
  const entries = store[profileId];
  if (!entries || !(date in entries)) return;
  const { [date]: _removed, ...rest } = entries;
  store[profileId] = rest;
  writeStore(store);
}

export function deleteAttendanceForProfile(profileId: string): void {
  const store = readStore();
  if (!(profileId in store)) return;
  delete store[profileId];
  writeStore(store);
}

export function subscribeToAttendanceChanges(onChange: () => void): () => void {
  return subscribeToKey(STORAGE_KEYS.attendance, onChange);
}
