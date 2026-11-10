import { AtSign, Check, Eye, EyeOff, MailCheck, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Feedback'
import { Field, Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { AuthShell } from './AuthShell'

const USERNAME_RE = /^[a-z0-9_]{3,24}$/

function strength(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}

const strengthLabel = ['Too short', 'Weak', 'Okay', 'Good', 'Strong']
const strengthColor = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

export default function Signup() {
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  // Suggest a username from the name until the user edits it themselves.
  useEffect(() => {
    if (usernameTouched) return
    setUsername(
      fullName
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 20),
    )
  }, [fullName, usernameTouched])

  useEffect(() => {
    if (!USERNAME_RE.test(username)) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    const t = setTimeout(async () => {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('username', username)
      setAvailability(count ? 'taken' : 'available')
    }, 350)
    return () => clearTimeout(t)
  }, [username])

  const pwStrength = password.length < 8 ? 0 : strength(password)
  const usernameValid = USERNAME_RE.test(username)
  const canSubmit = fullName.trim() && usernameValid && availability !== 'taken' && email && password.length >= 8

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), username },
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      toast.success(`Welcome to Trove, ${fullName.trim().split(' ')[0]}!`)
    } else {
      setSentTo(email.trim())
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" subtitle={<>We sent a confirmation link to <span className="font-medium text-ink">{sentTo}</span>.</>}>
        <div className="rounded-3xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <MailCheck className="size-6" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Click the link in the email to activate your account, then come back and log in. Can’t find it? Check your spam folder.
          </p>
        </div>
        <Link to="/login" className="mt-6 block text-center text-sm font-semibold underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Free forever. Start buying and selling in minutes.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name">
          <Input id="name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Morgan" autoFocus maxLength={80} />
        </Field>
        <Field
          label="Username"
          htmlFor="username"
          error={
            username && !usernameValid
              ? '3–24 characters: lowercase letters, numbers and underscores'
              : availability === 'taken'
                ? 'That username is taken'
                : null
          }
        >
          <div className="relative">
            <AtSign className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsernameTouched(true)
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))
              }}
              placeholder="alexmorgan"
              className="pr-10 pl-9"
              maxLength={24}
              aria-invalid={availability === 'taken' || (Boolean(username) && !usernameValid)}
            />
            <span className="absolute top-1/2 right-3.5 -translate-y-1/2">
              {availability === 'checking' && <Spinner className="size-4" />}
              {availability === 'available' && <Check className="size-4 text-success" />}
              {availability === 'taken' && <X className="size-4 text-danger" />}
            </span>
          </div>
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full bg-surface-3 transition-colors', i < pwStrength && strengthColor[pwStrength])} />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-muted">{strengthLabel[pwStrength]}</span>
            </div>
          )}
        </Field>
        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!canSubmit}>
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted">
          By signing up you agree to be kind to other traders. Trove is a demo — no real payments are taken.
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
