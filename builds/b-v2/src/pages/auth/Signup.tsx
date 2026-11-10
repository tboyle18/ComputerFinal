import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { displayNameSchema, emailSchema, fieldErrors, passwordSchema } from '../../lib/validation';
import { siteUrl } from '../../lib/redirect';
import { useCaptcha } from '../../components/Turnstile';
import { Alert, Button, Field, Input } from '../../components/ui';
import { PasswordMeter } from '../../components/PasswordMeter';
import { AuthShell } from './AuthShell';

const schema = z
  .object({
    display_name: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    terms: z.literal(true, { error: 'Please accept the terms to continue.' }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match.' });

export function Signup() {
  const [form, setForm] = useState({ display_name: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const captcha = useCaptcha('signup');

  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // Sanitised again server-side before it becomes a public profile name.
        data: { display_name: parsed.data.display_name },
        emailRedirectTo: siteUrl('/auth/callback'),
        captchaToken: captcha.captchaToken,
      },
    });
    setBusy(false);
    captcha.reset();
    if (error) {
      setFormError(friendlyError(error, 'We couldn’t create your account. Please try again.'));
      return;
    }
    // SECURITY: always show the same "check your email" screen. With email
    // confirmation on, Supabase doesn't reveal whether the address was
    // already registered, so attackers can't enumerate accounts.
    setSentTo(parsed.data.email);
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox">
        <div className="card p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <MailCheck className="size-7" />
          </div>
          <p className="mt-4 text-muted">
            If <span className="font-semibold text-ink">{sentTo}</span> can be registered, we’ve sent a confirmation link to
            it. Open it on this device to activate your account.
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-brand-ink hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/login" className="font-semibold text-brand-ink hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Display name" error={errors.display_name} hint="Shown publicly on your listings and profile.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!errors.display_name}
              autoComplete="nickname"
              maxLength={40}
              value={form.display_name}
              onChange={(e) => set('display_name')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email} hint="Private. Never shown to other users.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!errors.email}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(id, d) => (
            <div className="space-y-2">
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!errors.password}
                type="password"
                autoComplete="new-password"
                maxLength={72}
                value={form.password}
                onChange={(e) => set('password')(e.target.value)}
              />
              <PasswordMeter password={form.password} />
            </div>
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!errors.confirm}
              type="password"
              autoComplete="new-password"
              maxLength={72}
              value={form.confirm}
              onChange={(e) => set('confirm')(e.target.value)}
            />
          )}
        </Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => set('terms')(e.target.checked)}
            className="mt-0.5 size-4 rounded accent-[var(--brand)]"
          />
          <span>I agree to the Terms of Service and Privacy Policy, and I’m at least 18 years old.</span>
        </label>
        {errors.terms && <p className="-mt-3 text-sm text-danger">{errors.terms}</p>}
        {captcha.widget}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!captcha.ready}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
