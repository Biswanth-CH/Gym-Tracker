/**
 * Turns Supabase / network failures into clear, user-facing messages.
 * Cloud updates are never silently ignored: callers surface these messages.
 */

export type CloudErrorKind = 'network' | 'auth' | 'conflict' | 'permission' | 'validation' | 'unknown';

export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  readonly code?: string;

  constructor(message: string, kind: CloudErrorKind, code?: string) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
    this.code = code;
  }
}

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

export function toCloudError(error: unknown, fallback = 'Something went wrong while syncing.'): CloudError {
  if (error instanceof CloudError) return error;
  const like = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
  const message = typeof like.message === 'string' ? like.message : '';
  const code = typeof like.code === 'string' ? like.code : undefined;
  const status = typeof like.status === 'number' ? like.status : undefined;

  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return new CloudError('Can’t reach the GymTrack server. Check your internet connection and try again.', 'network', code);
  }
  if (code === '23505') return new CloudError('That already exists.', 'conflict', code);
  if (code === 'PGRST301' || status === 401 || /jwt|session.*expired|refresh token/i.test(message)) {
    return new CloudError('Your session has expired. Please sign in again.', 'auth', code);
  }
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(message)) {
    return new CloudError('You don’t have access to that data.', 'permission', code);
  }
  if (code === '23514' || code === '22P02' || code === '23502') {
    return new CloudError('Some values were rejected by the server. Please check them and try again.', 'validation', code);
  }
  return new CloudError(message ? `${fallback} (${message})` : fallback, 'unknown', code);
}

/** PostgREST could not find a column (e.g. a newer migration has not been applied yet). */
export function isMissingColumnError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST204' || code === '42703' || /could not find the .* column|column .* does not exist/i.test(message);
}

/** Throws a CloudError when a Supabase response contains an error. */
export function ensureOk<T>(result: { data: T; error: unknown }, fallback: string): T {
  if (result.error) throw toCloudError(result.error, fallback);
  return result.data;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
