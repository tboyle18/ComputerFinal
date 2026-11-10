import { supabase } from './supabase';
import { UserFacingError } from './errors';

export async function getVerifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.all.find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

/** Verify a 6-digit code and upgrade the session to aal2. */
export async function verifyTotp(code: string) {
  const factor = await getVerifiedTotpFactor();
  if (!factor) throw new UserFacingError('No authenticator app is set up on this account.');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw error;
}

/**
 * SECURITY: re-authentication for sensitive actions (password change, account
 * deletion). Proves the person at the keyboard knows the password (and 2FA
 * code), not just that they found an unlocked, logged-in browser. The Edge
 * Function for account deletion independently checks how recent this was.
 */
export async function reauthenticate(opts: {
  email: string;
  password: string;
  totpCode?: string;
  captchaToken?: string;
}) {
  const { error } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
    options: { captchaToken: opts.captchaToken },
  });
  if (error) {
    if (error.code === 'invalid_credentials') throw new UserFacingError('Your current password is incorrect.');
    throw error;
  }
  if (await getVerifiedTotpFactor()) {
    if (!opts.totpCode) throw new UserFacingError('Enter the code from your authenticator app.');
    await verifyTotp(opts.totpCode);
  }
}
