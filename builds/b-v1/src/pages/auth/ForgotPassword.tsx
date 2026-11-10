import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/utils'
import { AuthShell } from './AuthShell'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(errorMessage(error))
    else setSent(true)
  }

  return (
    <AuthShell
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={sent ? `If an account exists for ${email}, a reset link is on its way.` : 'We’ll email you a link to choose a new one.'}
    >
      {sent ? (
        <div className="rounded-3xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <MailCheck className="size-6" />
          </div>
          <p className="mt-4 text-sm text-muted">The link expires in an hour. You can close this tab.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to log in
      </Link>
    </AuthShell>
  )
}
