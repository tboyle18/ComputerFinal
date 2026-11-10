import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Edit2, Save, X } from 'lucide-react'

interface UserListing {
  id: number
  title: string
  price: number
  status: string
  created_at: string
}

export default function Profile() {
  const { user, profile, loadSession } = useAuthStore()
  const [listings, setListings] = useState<UserListing[]>([])
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUserListings()
  }, [user])

  const loadUserListings = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('listings')
        .select('id, title, price, status, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })

      if (err) throw err
      setListings(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load listings'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      setSaving(true)
      setError('')

      const { error: err } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          bio: bio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (err) throw err

      await loadSession()
      setEditing(false)
      setSuccess('Profile updated!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteListing = async (listingId: number) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return

    try {
      const { error: err } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId)
        .eq('seller_id', user?.id)

      if (err) throw err

      setListings(listings.filter(l => l.id !== listingId))
      setSuccess('Listing deleted!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete listing'
      setError(message)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{profile?.full_name}</h1>
              <p className="text-gray-600">@{profile?.username}</p>
            </div>
            <button
              onClick={() => {
                if (editing) {
                  setFullName(profile?.full_name || '')
                  setBio(profile?.bio || '')
                }
                setEditing(!editing)
              }}
              className="flex items-center space-x-2 text-primary hover:underline"
            >
              <Edit2 size={18} />
              <span>{editing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-24"
                />
                <p className="text-sm text-gray-500 mt-1">{bio.length}/500</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition font-medium flex items-center space-x-2"
              >
                <Save size={18} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-700 mb-4">{profile?.bio || 'No bio yet'}</p>
              <p className="text-gray-600">
                Member since {new Date(profile?.created_at || '').toLocaleDateString()}
              </p>
            </>
          )}
        </div>

        {/* My Listings */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">My Listings</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : listings.length === 0 ? (
            <p className="text-gray-600">You haven't created any listings yet.</p>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary transition flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-bold text-gray-900">{listing.title}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                      <span>${listing.price.toFixed(2)}</span>
                      <span className={`px-3 py-1 rounded-full ${
                        listing.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : listing.status === 'sold'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                      </span>
                      <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteListing(listing.id)}
                    className="text-red-600 hover:text-red-800 transition flex items-center space-x-1"
                  >
                    <X size={18} />
                    <span>Delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
