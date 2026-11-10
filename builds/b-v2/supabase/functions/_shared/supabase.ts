// Supabase clients for Edge Functions.
//
// SECURITY: the secret (service-role) key never leaves Supabase. It's injected
// into the Edge Function runtime by the platform and is never copied into the
// frontend, Cloudflare or the repository.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';

function readKey(jsonEnv: string, legacyEnv: string): string {
  const raw = Deno.env.get(jsonEnv);
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // fall through to the legacy variable
    }
  }
  const legacy = Deno.env.get(legacyEnv);
  if (legacy) return legacy;
  throw new Error(`Missing ${jsonEnv} / ${legacyEnv}`);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const PUBLISHABLE_KEY = readKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SECRET_KEY = readKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** A client that acts AS the caller, so RLS and database checks apply to them. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Privileged client. Bypasses RLS: use only after authorising the caller. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SECRET_KEY, { auth: noSession });
}

/**
 * Validate the access token with Supabase Auth (signature, expiry, and that
 * the user/session still exists) and return the user plus the verified claims.
 */
export async function authenticate(
  accessToken: string,
): Promise<{ user: User; claims: Record<string, unknown> } | null> {
  const client = userClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  // Token is verified by the Auth server above, so its payload is trustworthy.
  const payload = accessToken.split('.')[1];
  const claims = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ),
  ) as Record<string, unknown>;
  if (claims.sub !== data.user.id) return null;
  return { user: data.user, claims };
}

/** Delete every object in a user's folders (listing photos + avatars). */
export async function removeUserFiles(admin: SupabaseClient, userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of ['listing-images', 'avatars']) {
    // Loop until the folder is empty (list() is paginated).
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 100 });
      if (error) throw error;
      if (!data || data.length === 0) break;
      const paths = data.map((f) => `${userId}/${f.name}`);
      const { error: rmError } = await admin.storage.from(bucket).remove(paths);
      if (rmError) throw rmError;
      removed += paths.length;
    }
  }
  return removed;
}
