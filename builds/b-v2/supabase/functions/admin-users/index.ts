// POST /functions/v1/admin-users
// Body: { "action": "suspend" | "unsuspend" | "delete", "user_id": "<uuid>", "reason"?: string }
//
// Admin-only user moderation. These actions need the Auth Admin API (ban /
// delete users), which requires the secret key, so they can't live in SQL.
//
// SECURITY:
// 1. The caller's token is verified with Supabase Auth (auth.getUser).
// 2. Authorisation is decided by the DATABASE: admin_get_user() is called as
//    the caller and raises unless they're in private.admins AND on a 2FA
//    (aal2) session. There's no second, drift-prone copy of the admin rule here.
// 3. Admins can't act on themselves or on other admins (no lock-out or
//    privilege fights through the API; admin changes happen in SQL only).
// 4. Every action is written to the append-only admin_audit_log.
// 5. Errors returned to the client are generic; details go to function logs.
import {
  bearerToken,
  errorResponse,
  json,
  originAllowed,
  preflight,
  readJsonObject,
  UUID_RE,
} from '../_shared/http.ts';
import { adminClient, authenticate, removeUserFiles, userClient } from '../_shared/supabase.ts';

const ACTIONS = new Set(['suspend', 'unsuspend', 'delete']);
// ~100 years: Supabase Auth's way of saying "banned until further notice".
const PERMANENT_BAN = '876000h';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return errorResponse(req, 405, 'Method not allowed.');
  if (!originAllowed(req)) return errorResponse(req, 403, 'Origin not allowed.');

  const token = bearerToken(req);
  if (!token) return errorResponse(req, 401, 'Please sign in.');

  const body = await readJsonObject(req);
  const action = typeof body?.action === 'string' ? body.action : '';
  const targetId = typeof body?.user_id === 'string' ? body.user_id.toLowerCase() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!ACTIONS.has(action) || !UUID_RE.test(targetId)) {
    return errorResponse(req, 400, 'Invalid request.');
  }

  try {
    const auth = await authenticate(token);
    if (!auth) return errorResponse(req, 401, 'Your session has expired. Please sign in again.');

    // Database-side authorisation (admin + aal2). Also loads the target.
    const { data: target, error: targetError } = await userClient(token).rpc('admin_get_user', {
      p_user_id: targetId,
    });
    if (targetError) {
      if (targetError.code === 'PT403') return errorResponse(req, 403, targetError.message);
      if (targetError.code === 'PT404') return errorResponse(req, 404, 'User not found.');
      console.error('admin_get_user failed', targetError);
      return errorResponse(req, 500, 'Something went wrong.');
    }

    const t = target as { id: string; display_name: string; is_admin: boolean; suspended_at: string | null };
    if (t.id === auth.user.id) {
      return errorResponse(req, 400, 'You can’t perform this action on your own account.');
    }
    if (t.is_admin) {
      return errorResponse(req, 400, 'Admins can’t be moderated here. Revoke admin rights in SQL first.');
    }

    const admin = adminClient();

    if (action === 'suspend') {
      // Flip the database flag first: RLS blocks all writes immediately, even
      // while the user's current access token is still valid.
      const { error: e1 } = await admin
        .from('profiles')
        .update({ suspended_at: new Date().toISOString() })
        .eq('id', t.id);
      if (e1) throw e1;
      // Then ban in Auth so they can't sign in or refresh their session.
      const { error: e2 } = await admin.auth.admin.updateUserById(t.id, { ban_duration: PERMANENT_BAN });
      if (e2) throw e2;
    } else if (action === 'unsuspend') {
      const { error: e1 } = await admin.auth.admin.updateUserById(t.id, { ban_duration: 'none' });
      if (e1) throw e1;
      const { error: e2 } = await admin.from('profiles').update({ suspended_at: null }).eq('id', t.id);
      if (e2) throw e2;
    } else {
      // Block the account first so nothing new is created mid-deletion.
      await admin.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', t.id);
      await removeUserFiles(admin, t.id);
      // Cascades to profile, listings, cart, conversations and messages.
      // Order records are kept (buyer/seller set to null) for the other party.
      const { error } = await admin.auth.admin.deleteUser(t.id);
      if (error) throw error;
    }

    const { error: auditError } = await admin.from('admin_audit_log').insert({
      admin_id: auth.user.id,
      action: `user.${action}`,
      target_type: 'user',
      target_id: t.id,
      // Store the minimum needed for accountability (no email or other PII).
      details: { display_name: t.display_name, reason: reason || null },
    });
    if (auditError) console.error('audit log insert failed', auditError);

    return json(req, { ok: true });
  } catch (err) {
    console.error('admin-users failed', err);
    return errorResponse(req, 500, 'Something went wrong. Please try again.');
  }
});
