import { getSupabase } from '../../lib/supabaseClient';
import { toCloudError } from './cloudErrors';

/** The RPC is missing until the Phase 6 SQL runs: then no profile is locked. */
export function isMissingFunctionError(error: unknown): boolean {
  const like = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof like.code === 'string' ? like.code : '';
  const message = typeof like.message === 'string' ? like.message : '';
  return code === 'PGRST202' || code === '42883' || /could not find the function|function .* does not exist/i.test(message);
}

/**
 * Ids of the signed-in account's PIN-locked profiles (`list_locked_profiles()`,
 * SECURITY DEFINER, never returns hashes). Kept separate from the PIN service so the
 * cloud store can import it without an import cycle.
 */
export async function fetchLockedProfileIds(): Promise<string[]> {
  const { data, error } = await getSupabase().rpc('list_locked_profiles');
  if (error) {
    if (isMissingFunctionError(error)) return [];
    throw toCloudError(error, 'Could not load profile locks.');
  }
  return (Array.isArray(data) ? data : [])
    .map((row: unknown) => (typeof row === 'object' && row !== null ? (row as { profile_id?: unknown }).profile_id : null))
    .filter((profileId): profileId is string => typeof profileId === 'string');
}
