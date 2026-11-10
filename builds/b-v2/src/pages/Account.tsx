import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Copy, KeyRound, LogOut, ShieldCheck, Smartphone, Trash2, UserRound } from 'lucide-react';
import { getProfile, removeAvatar, replaceAvatar, updateProfile } from '../api/profiles';
import { invokeFunction } from '../api/admin';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { friendlyError, UserFacingError } from '../lib/errors';
import { fieldErrors, passwordSchema, profileSchema } from '../lib/validation';
import { getVerifiedTotpFactor, reauthenticate, verifyTotp } from '../lib/mfa';
import { useCaptcha } from '../components/Turnstile';
import { useToast } from '../components/Toast';
import { PasswordMeter } from '../components/PasswordMeter';
import { Alert, Avatar, Badge, Button, Field, Input, Modal, PageLoader, Textarea } from '../components/ui';

export function Account() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <p className="mt-1 text-muted">Manage your profile, security and account.</p>
      <div className="mt-8 space-y-6">
        <ProfileSection />
        <TwoFactorSection />
        <PasswordSection />
        <SessionsSection />
        <DangerZone />
      </div>
    </div>
  );
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">{icon}</span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Profile --- */
function ProfileSection() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: profile, isPending } = useQuery({ queryKey: keys.profile(user!.id), queryFn: () => getProfile(user!.id) });
  const [form, setForm] = useState<{ display_name: string; location: string; bio: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const values = form ?? { display_name: profile?.display_name ?? '', location: profile?.location ?? '', bio: profile?.bio ?? '' };
  const onSaved = (p: unknown) => {
    queryClient.setQueryData(keys.profile(user!.id), p);
  };

  const save = useMutation({
    mutationFn: (v: typeof values) => updateProfile(user!.id, v),
    onSuccess: (p) => {
      onSaved(p);
      setForm(null);
      toast.success('Profile saved.');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const avatar = useMutation({
    mutationFn: (file: File) => replaceAvatar(user!.id, file, profile?.avatar_path ?? null),
    onSuccess: (p) => {
      onSaved(p);
      toast.success('Photo updated.');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const clearAvatar = useMutation({
    mutationFn: () => removeAvatar(user!.id, profile!.avatar_path!),
    onSuccess: onSaved,
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (isPending || !profile) return <PageLoader />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(parsed.data);
  };
  const set = (k: keyof typeof values) => (v: string) => setForm({ ...values, [k]: v });

  return (
    <Section icon={<UserRound className="size-5" />} title="Public profile" description="This is what other people see.">
      <div className="mb-6 flex items-center gap-5">
        <Avatar name={profile.display_name} path={profile.avatar_path} size={64} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<Camera className="size-4" />} loading={avatar.isPending} onClick={() => fileRef.current?.click()}>
            Change photo
          </Button>
          {profile.avatar_path && (
            <Button variant="ghost" size="sm" loading={clearAvatar.isPending} onClick={() => clearAvatar.mutate()}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) avatar.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Display name" error={errors.display_name}>
            {(id) => <Input id={id} value={values.display_name} onChange={(e) => set('display_name')(e.target.value)} maxLength={40} />}
          </Field>
          <Field label="Location" error={errors.location} hint="City or region only.">
            {(id, d) => <Input id={id} aria-describedby={d} value={values.location} onChange={(e) => set('location')(e.target.value)} maxLength={80} />}
          </Field>
        </div>
        <Field label="Bio" error={errors.bio} counter={{ value: values.bio.length, max: 500 }}>
          {(id) => <Textarea id={id} value={values.bio} onChange={(e) => set('bio')(e.target.value)} maxLength={500} rows={3} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={!form}>
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ----------------------------------------------------------------- 2FA ----- */
function TwoFactorSection() {
  const { refreshAal } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: factor, isPending, refetch } = useQuery({ queryKey: ['mfa-factor'], queryFn: getVerifiedTotpFactor });
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      // Clean up abandoned, unverified enrolments first.
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: e, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
      });
      if (error) throw error;
      // Only render a QR that is really an inline SVG image from Supabase.
      if (!e.totp.qr_code.startsWith('data:image/svg+xml')) throw new UserFacingError('Unexpected QR code format.');
      setEnroll({ id: e.id, qr: e.totp.qr_code, secret: e.totp.secret });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!enroll || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
      if (error) throw error;
      await refreshAal();
      setEnroll(null);
      setCode('');
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ['admin-status'] });
      toast.success('Two-factor authentication is on.');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      icon={<Smartphone className="size-5" />}
      title="Two-factor authentication"
      description="Require a code from an authenticator app when you sign in. Required for admins."
    >
      {isPending ? null : factor ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-sm">
            <Badge tone="success">
              <ShieldCheck className="size-3.5" /> On
            </Badge>
            Your account is protected with an authenticator app.
          </p>
          <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
            Turn off
          </Button>
          <DisableTwoFactor open={disableOpen} onClose={() => setDisableOpen(false)} factorId={factor.id} onDone={refetch} />
        </div>
      ) : enroll ? (
        <form onSubmit={confirm} className="grid gap-6 sm:grid-cols-[180px_1fr]">
          <img src={enroll.qr} alt="QR code for your authenticator app" className="size-44 rounded-2xl bg-white p-2 ring-1 ring-line" />
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Scan the QR code with an authenticator app (1Password, Google Authenticator, Authy…).</li>
              <li>Enter the 6-digit code it shows.</li>
            </ol>
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
              <code className="min-w-0 flex-1 break-all font-mono">{enroll.secret}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(enroll.secret).then(() => toast.info('Secret copied.'))}
                className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink"
                aria-label="Copy secret"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                aria-label="6-digit code"
                className="max-w-36 text-center font-mono tracking-widest"
              />
              <Button type="submit" loading={busy} disabled={code.length !== 6}>
                Verify & turn on
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button onClick={start} loading={busy} icon={<ShieldCheck className="size-4" />}>
          Set up authenticator app
        </Button>
      )}
    </Section>
  );
}

function DisableTwoFactor({ open, onClose, factorId, onDone }: { open: boolean; onClose: () => void; factorId: string; onDone: () => void }) {
  const toast = useToast();
  const { refreshAal } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      // Fresh proof of possession before removing the second factor.
      await verifyTotp(code);
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await supabase.auth.refreshSession();
      await refreshAal();
      toast.success('Two-factor authentication turned off.');
      onClose();
      onDone();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
      setCode('');
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Turn off two-factor authentication?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={code.length !== 6} onClick={submit}>
            Turn off
          </Button>
        </>
      }
    >
      <Alert tone="warning" icon={<AlertTriangle className="size-4" />}>
        Your account will be easier to break into. Admins lose access to the admin dashboard.
      </Alert>
      <Field label="Enter a current code to confirm" className="mt-4">
        {(id) => (
          <Input id={id} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono tracking-widest" />
        )}
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------ Password ----- */
function useHasTotp() {
  return useQuery({ queryKey: ['mfa-factor'], queryFn: getVerifiedTotpFactor }).data;
}

function PasswordSection() {
  const { user, withReauth } = useAuth();
  const toast = useToast();
  const hasTotp = useHasTotp();
  const captcha = useCaptcha('change_password');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = passwordSchema.safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
    if (next !== confirm) return setError('New passwords don’t match.');
    if (next === current) return setError('Your new password must be different.');
    setBusy(true);
    try {
      await withReauth(() =>
        reauthenticate({ email: user!.email!, password: current, totpCode: code || undefined, captchaToken: captcha.captchaToken }),
      );
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      // SECURITY: a changed password should kick out every other session.
      await supabase.auth.signOut({ scope: 'others' });
      setCurrent('');
      setNext('');
      setConfirm('');
      setCode('');
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      captcha.reset();
      setBusy(false);
    }
  };

  return (
    <Section icon={<KeyRound className="size-5" />} title="Password" description="Changing it signs you out on other devices.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Current password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" maxLength={72} value={current} onChange={(e) => setCurrent(e.target.value)} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password">
            {(id) => (
              <div className="space-y-2">
                <Input id={id} type="password" autoComplete="new-password" maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
                <PasswordMeter password={next} />
              </div>
            )}
          </Field>
          <Field label="Confirm new password">
            {(id) => <Input id={id} type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
        </div>
        {hasTotp && (
          <Field label="Authenticator code">
            {(id) => (
              <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="max-w-36 font-mono tracking-widest" />
            )}
          </Field>
        )}
        {captcha.widget}
        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={!current || !next || !captcha.ready}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------ Sessions ----- */
function SessionsSection() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Section icon={<LogOut className="size-5" />} title="Sessions" description="Lost a device or used a shared computer?">
      <Button
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await signOut('global');
          toast.success('Signed out of all devices.');
          navigate('/login');
        }}
      >
        Sign out of all devices
      </Button>
    </Section>
  );
}

/* ---------------------------------------------------------- Danger zone ---- */
function DangerZone() {
  const { user, signOut, withReauth } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const hasTotp = useHasTotp();
  const captcha = useCaptcha('delete_account');
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await withReauth(() =>
        reauthenticate({ email: user!.email!, password, totpCode: code || undefined, captchaToken: captcha.captchaToken }),
      );
      await invokeFunction('delete-account', { confirm: 'DELETE' });
      await signOut('local');
      toast.success('Your account and data have been deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
      captcha.reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[1.25rem] border border-danger/30 bg-danger-soft/40 p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-danger">
        <Trash2 className="size-5" /> Delete account
      </h2>
      <p className="mt-1 text-sm text-muted">
        Permanently deletes your profile, listings, photos and messages. Order records are kept for the other party.
      </p>
      <Button variant="danger" className="mt-5" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} disabled={typed !== 'DELETE' || !password || !captcha.ready} onClick={submit}>
              Permanently delete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="danger" icon={<AlertTriangle className="size-4" />}>
            This can’t be undone.
          </Alert>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Confirm your password">
            {(id) => <Input id={id} type="password" autoComplete="current-password" maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          {hasTotp && (
            <Field label="Authenticator code">
              {(id) => <Input id={id} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="font-mono tracking-widest" />}
            </Field>
          )}
          <Field label='Type "DELETE" to confirm'>
            {(id) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
          </Field>
          {captcha.widget}
        </div>
      </Modal>
    </section>
  );
}
