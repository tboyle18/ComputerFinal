import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { verifyTotp } from '../../lib/mfa';
import { friendlyError } from '../../lib/errors';
import { Alert, Button, Field, Input } from '../../components/ui';

/** Shown instead of any page while a 2FA-enrolled user is on an aal1 session. */
export function MfaChallenge() {
  const { refreshAal, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(code);
      await refreshAal();
      await queryClient.invalidateQueries();
    } catch (err) {
      setError(friendlyError(err, 'That code didn’t work. Try again.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:py-24">
      <div className="card p-8 animate-rise">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Two-factor verification</h1>
        <p className="mt-2 text-muted">Enter the 6-digit code from your authenticator app to continue.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Authentication code">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono text-2xl tracking-[0.5em]"
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Verify
          </Button>
        </form>
        <button
          onClick={async () => {
            await signOut('local');
            navigate('/login');
          }}
          className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
