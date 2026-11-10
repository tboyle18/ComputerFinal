import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { MailCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { emailSchema, passwordSchema } from '../../lib/validation';
import { siteUrl } from '../../lib/redirect';
import { useAuth } from '../../auth/AuthProvider';
import { useCaptcha } from '../../components/Turnstile';
import { useToast } from '../../components/Toast';
import { PasswordMeter } from '../../components/PasswordMeter';
import { Alert, Button, Field, Input, PageLoader } from '../../components/ui';
import { AuthShell } from './AuthShell';

/* ------------------------------------------------------ Forgot password --- */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const captcha = useCaptcha('password_reset');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: siteUrl('/reset-password'),
      captchaToken: captcha.captchaToken,
    });
    setBusy(false);
    captcha.reset();
    // SECURITY: rate-limit and CAPTCHA errors are shown, but "no such user"
    // never is: the response is identical whether or not the account exists.
    if (resetError && ['over_email_send_rate_limit', 'over_request_rate_limit', 'captcha_failed'].includes(resetError.code ?? '')) {
      setError(friendlyError(resetError));
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell title="Reset your password" subtitle="We’ll email you a secure link to choose a new one.">
      {sent ? (
        <div className="card p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <MailCheck className="size-7" />
          </div>
          <p className="mt-4 text-muted">
            If an account exists for that address, a reset link is on its way. It expires in one hour and only works in this
            browser.
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-brand-ink hover:underline">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email">
            {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {captcha.widget}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!captcha.ready}>
            Send reset link
          </Button>
          <p className="text-center text-sm text-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-brand-ink hover:underline">
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

/* ------------------------------------------------------- Reset password --- */
export function ResetPassword() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;
  if (!session) return <InvalidLink />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(friendlyError(updateError));
      return;
    }
    // SECURITY: after a password reset, end every other session (e.g. one an
    // attacker may have), then ask the user to log in fresh.
    await supabase.auth.signOut({ scope: 'global' });
    await signOut('local');
    toast.success('Password updated.');
    navigate('/login?reset=1', { replace: true });
  };

  return (
    <AuthShell title="Choose a new password" subtitle="You’ll be signed out everywhere else for safety.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="New password">
          {(id) => (
            <div className="space-y-2">
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordMeter password={password} />
            </div>
          )}
        </Field>
        <Field label="Confirm new password">
          {(id) => (
            <Input id={id} type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

function InvalidLink() {
  return (
    <AuthShell title="This link has expired">
      {/* SECURITY: never echo `error_description` from the URL. It's attacker-
          controllable text and could be used for convincing phishing messages. */}
      <Alert tone="warning">
        Reset links expire after an hour, can only be used once and must be opened in the browser that requested them.
      </Alert>
      <Link to="/forgot-password" className="mt-6 inline-block font-semibold text-brand-ink hover:underline">
        Request a new link
      </Link>
    </AuthShell>
  );
}

/* ------------------------------------------------- Email confirmation ----- */
export function AuthCallback() {
  const { session, loading } = useAuth();
  const toast = useToast();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && session && !done) {
      setDone(true);
      toast.success('Email confirmed. Welcome to Curio!');
    }
  }, [loading, session, done, toast]);

  if (loading) return <PageLoader />;
  if (session) return <Navigate to="/" replace />;
  return (
    <AuthShell title="Almost there">
      <Alert tone="neutral">
        If you just confirmed your email, you can now log in. If the link has expired, sign up again or request a new link.
      </Alert>
      <Link to="/login" className="mt-6 inline-block font-semibold text-brand-ink hover:underline">
        Go to log in
      </Link>
    </AuthShell>
  );
}
