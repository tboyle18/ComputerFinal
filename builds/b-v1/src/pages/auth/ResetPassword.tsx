import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Feedback'
import { Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/utils'
import { AuthShell } from './AuthShell'

/** Landing page for the password-reset email link (Supabase signs the user in via the URL). */
export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <PageLoader />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters')
    if (password !== confirm) return setError('Passwords don’t match')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) return setError(errorMessage(error))
    toast.success('Password updated')
    navigate('/')
  }

  if (!user) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has already been used.">
        <Link to="/forgot-password" className="text-sm font-semibold underline-offset-4 hover:underline">
          Request a new link →
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" htmlFor="pw">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirm password" htmlFor="pw2">
          <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={saving}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
