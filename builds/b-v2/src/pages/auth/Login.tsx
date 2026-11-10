import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { emailSchema } from '../../lib/validation';
import { useCaptcha } from '../../components/Turnstile';
import { Alert, Button, Field, Input } from '../../components/ui';
import { AuthShell } from './AuthShell';

export function Login() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const captcha = useCaptcha('login');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data,
      password,
      options: { captchaToken: captcha.captchaToken },
    });
    setBusy(false);
    captcha.reset(); // CAPTCHA tokens are single-use
    if (signInError) {
      // SECURITY: one generic message for "no such user" and "wrong password"
      // so the form can't be used to discover who has an account.
      setError(friendlyError(signInError, 'Incorrect email or password.'));
      setPassword('');
    }
    // On success the auth listener updates the session; the route guard then
    // continues to ?next= and the 2FA gate prompts for a code if enrolled.
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to Curio?{' '}
          <Link to={`/signup${params.toString() ? `?${params}` : ''}`} className="font-semibold text-brand-ink hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {params.get('reset') === '1' && <Alert tone="success">Password updated. Please log in with your new password.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email">
          {(id) => (
            <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={72}
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-ink hover:underline">
            Forgot password?
          </Link>
        </div>
        {captcha.widget}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!captcha.ready}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
