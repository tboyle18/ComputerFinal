import { AtSign, Camera, LogOut, MapPin, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { ThemeSwitch } from '../components/layout/ThemeSwitch'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { removeAvatarByUrl, uploadAvatar } from '../lib/images'
import { supabase } from '../lib/supabase'
import { displayName, errorMessage } from '../lib/utils'

const USERNAME_RE = /^[a-z0-9_]{3,24}$/

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  if (!profile || !user) return null

  const dirty =
    fullName !== profile.full_name || username !== profile.username || bio !== profile.bio || location !== profile.location

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!USERNAME_RE.test(username)) {
      setUsernameError('3–24 characters: lowercase letters, numbers and underscores')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), username, bio: bio.trim(), location: location.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      if (error.code === '23505') setUsernameError('That username is taken')
      else toast.error(errorMessage(error))
      return
    }
    await refreshProfile()
    toast.success('Profile saved')
  }

  const onAvatar = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image')
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      const previous = profile.avatar_url
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      if (error) throw error
      await removeAvatarByUrl(previous)
      await refreshProfile()
      toast.success('Looking good! Avatar updated.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = async () => {
    const previous = profile.avatar_url
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
    if (error) return toast.error(errorMessage(error))
    await removeAvatarByUrl(previous)
    await refreshProfile()
  }

  return (
    <PageContainer className="max-w-3xl pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1.5 text-muted">
        Manage how you appear on Trove.{' '}
        <Link to={`/u/${profile.username}`} className="font-medium text-ink underline-offset-4 hover:underline">
          View public profile →
        </Link>
      </p>

      <form onSubmit={save} className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-5 flex items-center gap-5">
          <div className="relative">
            <Avatar src={profile.avatar_url} name={displayName(profile)} seed={profile.id} size={88} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full bg-ink text-canvas shadow-lift ring-4 ring-surface transition hover:scale-105 disabled:opacity-60"
              aria-label="Change photo"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                Upload photo
              </Button>
              {profile.avatar_url && (
                <Button variant="ghost" size="sm" onClick={removeAvatar}>
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Square images work best. We’ll resize it for you.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onAvatar(e.target.files?.[0]); e.target.value = '' }} />
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Username" htmlFor="username" error={usernameError}>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))
                  setUsernameError(null)
                }}
                className="pl-9"
                maxLength={24}
                aria-invalid={Boolean(usernameError)}
              />
            </div>
          </Field>
          <Field label="Location" htmlFor="location" className="sm:col-span-2" hint="Shown on your profile and pre-filled on new listings.">
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className="pl-10" maxLength={80} />
            </div>
          </Field>
          <Field label="Bio" htmlFor="bio" className="sm:col-span-2" aside={`${bio.length}/500`}>
            <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="A sentence or two about you and what you sell." />
          </Field>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-5 divide-y divide-line">
          <div className="flex items-center justify-between gap-4 pb-4">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-sm text-muted">Light, dark, or match your system.</p>
            </div>
            <ThemeSwitch className="w-32" />
          </div>
          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-sm text-muted">You’ll need to log in again to buy or sell.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                navigate('/')
                await signOut()
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </section>
    </PageContainer>
  )
}
