// POST /functions/v1/delete-account
// Body: { "confirm": "DELETE" }
//
// Lets a user permanently delete their own account and data (right to erasure).
//
// SECURITY:
// 1. Token verified with Supabase Auth.
// 2. Requires RECENT re-authentication: the token's `amr` claim must show a
//    password (or 2FA) verification within the last 10 minutes. A stolen,
//    older session token can't be used to wipe the account.
// 3. Users with 2FA enrolled must be on an aal2 session.
// 4. Admin accounts can't self-delete through the API (prevents an attacker
//    with a hijacked admin session from destroying evidence); revoke admin in
//    SQL first.
import {
  bearerToken,
  errorResponse,
  json,
  originAllowed,
  preflight,
  readJsonObject,
} from '../_shared/http.ts';
import { adminClient, authenticate, removeUserFiles, userClient } from '../_shared/supabase.ts';

const REAUTH_WINDOW_SECONDS = 10 * 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return errorResponse(req, 405, 'Method not allowed.');
  if (!originAllowed(req)) return errorResponse(req, 403, 'Origin not allowed.');

  const token = bearerToken(req);
  if (!token) return errorResponse(req, 401, 'Please sign in.');

  const body = await readJsonObject(req);
  if (body?.confirm !== 'DELETE') return errorResponse(req, 400, 'Invalid request.');

  try {
    const auth = await authenticate(token);
    if (!auth) return errorResponse(req, 401, 'Your session has expired. Please sign in again.');

    const now = Math.floor(Date.now() / 1000);
    const amr = Array.isArray(auth.claims.amr) ? (auth.claims.amr as Array<Record<string, unknown>>) : [];
    const recentlyVerified = amr.some(
      (entry) =>
        ['password', 'totp', 'otp'].includes(String(entry.method)) &&
        typeof entry.timestamp === 'number' &&
        now - entry.timestamp <= REAUTH_WINDOW_SECONDS,
    );
    if (!recentlyVerified) {
      return errorResponse(req, 403, 'Please confirm your password again before deleting your account.');
    }

    const hasVerifiedFactor = (auth.user.factors ?? []).some((f) => f.status === 'verified');
    if (hasVerifiedFactor && auth.claims.aal !== 'aal2') {
      return errorResponse(req, 403, 'Please complete two-factor verification first.');
    }

    const { data: status, error: statusError } = await userClient(token).rpc('admin_status');
    if (statusError) throw statusError;
    if ((status as { is_admin?: boolean })?.is_admin) {
      return errorResponse(req, 403, 'Admin accounts can’t be deleted from the app.');
    }

    const admin = adminClient();
    await removeUserFiles(admin, auth.user.id);
    const { error } = await admin.auth.admin.deleteUser(auth.user.id);
    if (error) throw error;

    return json(req, { ok: true });
  } catch (err) {
    console.error('delete-account failed', err);
    return errorResponse(req, 500, 'Something went wrong. Please try again.');
  }
});
