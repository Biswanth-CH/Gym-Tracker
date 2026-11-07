import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabaseConfig';

/** Name of the private Storage bucket for profile photos. */
export const PROFILE_PHOTO_BUCKET = 'gym-profile-photos';

let client: SupabaseClient | null = null;

/**
 * The single Supabase client for the app. Only services under
 * `src/services/cloud` and the cloud store should call this — UI components
 * go through those services and hooks.
 */
export function getSupabase(): SupabaseClient {
  if (!SUPABASE_CONFIG.ok) throw new Error('Supabase is not configured.');
  if (!client) {
    client = createClient(SUPABASE_CONFIG.config.url, SUPABASE_CONFIG.config.publishableKey, {
      auth: {
        // PKCE puts the auth code in ?code=… so it never collides with our #/hash routes.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gymtrack-auth',
      },
    });
  }
  return client;
}
