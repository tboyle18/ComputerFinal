import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { AuthShell } from './AuthShell'

export default function Login() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError(
        error.message.toLowerCase().includes('email not confirmed')
          ? 'Please confirm your email first — check your inbox for the link.'
          : error.message === 'Invalid login credentials'
            ? 'That email and password don’t match. Try again?'
            : error.message,
      )
      return
    }
    toast.success('Welcome back!')
    // <GuestOnly> redirects to where the user came from once the session lands.
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to buy, sell and chat on Trove.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          aside={
            <Link to="/forgot-password" className="font-medium text-ink-2 hover:text-ink">
              Forgot password?
            </Link>
          }
        >
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
        </Field>
        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
          Log in
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        New to Trove?{' '}
        <Link to="/signup" state={location.state} className="font-semibold text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
