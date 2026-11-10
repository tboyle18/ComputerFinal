/**
 * Turn any error into a message that's safe and helpful to show a user.
 *
 * SECURITY: raw database / server errors can leak internals (table names,
 * constraint names, SQL). We only show messages we wrote ourselves (the
 * P0001/PTxxx codes raised by our SQL functions and Edge Functions) or map
 * known codes to friendly text. Everything else gets a generic message.
 */
const OUR_CODES = new Set(['P0001', 'PT401', 'PT403', 'PT404', 'PT409', 'PT429']);

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email address first. Check your inbox for the link.',
  weak_password: 'That password is too weak. Use at least 10 characters with letters and numbers.',
  same_password: 'Your new password must be different from your current one.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait a few minutes and try again.',
  captcha_failed: 'The bot check failed. Please try again.',
  mfa_verification_failed: 'That code didn’t work. Check your authenticator app and try again.',
  mfa_challenge_expired: 'That code expired. Please enter a fresh one.',
  user_banned: 'This account has been suspended.',
  session_expired: 'Your session expired. Please sign in again.',
  session_not_found: 'Your session expired. Please sign in again.',
  reauthentication_needed: 'Please confirm your password again to continue.',
  signup_disabled: 'Sign-ups are currently closed.',
  validation_failed: 'Please check the details you entered.',
  email_address_invalid: 'Please use a valid email address.',
  insufficient_aal: 'Please complete two-factor verification first.',
};

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { code?: unknown; message?: unknown; name?: unknown; status?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const name = typeof e.name === 'string' ? e.name : '';

  if (OUR_CODES.has(code) && message) return message;
  if (name.startsWith('Auth') || name === 'FunctionsHttpError') {
    if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  }
  if (err instanceof UserFacingError) return err.message;
  if (code === '23505') return 'That already exists.';
  if (code === '23514') return 'Some details are invalid. Please check the form and try again.';
  if (code === '42501') return 'You don’t have permission to do that.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Network error. Check your connection and try again.';
  }
  if (import.meta.env.DEV) console.error(err);
  return fallback;
}

/** An error whose message we wrote and is safe to display. */
export class UserFacingError extends Error {}
