/**
 * Supabase configuration from Vite env variables (baked into the build).
 *
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
 *
 * The publishable key is safe in a public frontend: Row Level Security in
 * the database decides what each signed-in account may access. A secret or
 * service-role key would bypass RLS, so the app refuses to start with one.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export type ConfigResult = { ok: true; config: SupabaseConfig } | { ok: false; problems: string[] };

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function validateSupabaseConfig(rawUrl: string | undefined, rawKey: string | undefined): ConfigResult {
  const url = (rawUrl ?? '').trim().replace(/\/+$/, '');
  const publishableKey = (rawKey ?? '').trim();
  const problems: string[] = [];

  if (!url) problems.push('VITE_SUPABASE_URL is not set.');
  else {
    try {
      const parsed = new URL(url);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (parsed.protocol !== 'https:' && !isLocal) problems.push('VITE_SUPABASE_URL must start with https://.');
    } catch {
      problems.push('VITE_SUPABASE_URL is not a valid URL.');
    }
  }

  if (!publishableKey) problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set.');
  else if (publishableKey.startsWith('sb_secret_')) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY contains a SECRET key. Use the publishable key (sb_publishable_…) — never ship a secret key.');
  } else if (decodeJwtRole(publishableKey) === 'service_role') {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY contains a service-role key. Use the publishable key — never ship a service-role key.');
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, config: { url, publishableKey } };
}

export const SUPABASE_CONFIG: ConfigResult = validateSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/** The deployed app URL (e.g. https://biswanth-ch.github.io/Gym-Tracker/) used for auth email redirects. */
export function getAppUrl(): string {
  const path = window.location.pathname.replace(/index\.html$/, '');
  return `${window.location.origin}${path.endsWith('/') ? path : `${path}/`}`;
}
