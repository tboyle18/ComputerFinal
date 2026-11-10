import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Trash2, Users, ShoppingCart } from 'lucide-react'

interface User {
  id: string
  username: string
  email: string
  full_name: string
  is_admin: boolean
  created_at: string
}

interface AdminListing {
  id: number
  title: string
  seller_id: string
  price: number
  status: string
  created_at: string
  user_profiles: { username: string }
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [listings, setListings] = useState<AdminListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'users' | 'listings'>('users')

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load all users
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Load all listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          seller_id,
          price,
          status,
          created_at,
          user_profiles(username)
        `)
        .order('created_at', { ascending: false })

      if (listingsError) throw listingsError

      setUsers(usersData || [])
      setListings(listingsData || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user and all their data?')) {
      return
    }

    try {
      // Delete user and cascade will handle related data
      const { error: err } = await supabase.auth.admin.deleteUser(userId)
      if (err) throw err

      setUsers(users.filter((u) => u.id !== userId))
      setSuccess('User deleted')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user'
      setError(message)
    }
  }

  const handleDeleteListing = async (listingId: number) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) {
      return
    }

    try {
      const { error: err } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId)

      if (err) throw err

      setListings(listings.filter((l) => l.id !== listingId))
      setSuccess('Listing deleted')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete listing'
      setError(message)
    }
  }

  const handleToggleAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { error: err } = await supabase
        .from('user_profiles')
        .update({ is_admin: !isAdmin })
        .eq('id', userId)

      if (err) throw err

      setUsers(
        users.map((u) => (u.id === userId ? { ...u, is_admin: !isAdmin } : u))
      )
      setSuccess(`Admin status updated`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user'
      setError(message)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600 mb-8">Manage users and listings</p>

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

        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setTab('users')}
            className={`px-6 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
              tab === 'users'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users size={20} />
            <span>Users ({users.length})</span>
          </button>
          <button
            onClick={() => setTab('listings')}
            className={`px-6 py-2 rounded-lg font-medium transition flex items-center space-x-2 ${
              tab === 'listings'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart size={20} />
            <span>Listings ({listings.length})</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : tab === 'users' ? (
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{user.username}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">{user.full_name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          user.is_admin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800 flex items-center space-x-1 text-sm font-medium"
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={listing.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{listing.title}</td>
                    <td className="px-6 py-4 text-gray-600">
                      @{listing.user_profiles.username}
                    </td>
                    <td className="px-6 py-4">${listing.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          listing.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : listing.status === 'sold'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteListing(listing.id)}
                        className="text-red-600 hover:text-red-800 flex items-center space-x-1 text-sm font-medium"
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
