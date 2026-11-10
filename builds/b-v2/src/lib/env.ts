/**
 * Public runtime configuration. Everything here ships to the browser, so it
 * must only ever contain public values (the build also enforces this).
 */
export class ConfigError extends Error {}

function readConfig() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new ConfigError(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.',
    );
  }

  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new ConfigError('VITE_SUPABASE_URL is not a valid URL.');
  }
  const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !isLocal) {
    throw new ConfigError('VITE_SUPABASE_URL must use https://.');
  }

  // Defence in depth: refuse to run with a privileged key in the browser.
  if (supabaseKey.startsWith('sb_secret_')) {
    throw new ConfigError('A Supabase SECRET key was configured in the frontend. Use the publishable key.');
  }
  const payload = supabaseKey.split('.')[1];
  if (payload) {
    try {
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
      if (claims.role && claims.role !== 'anon') {
        throw new ConfigError('A privileged Supabase key was configured in the frontend. Use the anon/publishable key.');
      }
    } catch (err) {
      if (err instanceof ConfigError) throw err;
    }
  }

  return { supabaseUrl: url.origin, supabaseKey, turnstileSiteKey };
}

export const config = readConfig();
