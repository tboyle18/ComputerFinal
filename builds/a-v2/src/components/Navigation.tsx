import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { ShoppingCart, LogOut, Menu, Home, Plus, User } from 'lucide-react'
import { useState } from 'react'

export default function Navigation() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 font-bold text-xl text-primary">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white">M</span>
            </div>
            <span className="hidden sm:inline">MarketHub</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-primary transition">
              Browse
            </Link>

            {user ? (
              <>
                <Link to="/create-listing" className="text-gray-700 hover:text-primary transition flex items-center space-x-1">
                  <Plus size={18} />
                  <span>Sell</span>
                </Link>
                <Link to="/cart" className="text-gray-700 hover:text-primary transition relative">
                  <ShoppingCart size={20} />
                </Link>
                <Link to="/orders" className="text-gray-700 hover:text-primary transition">
                  Orders
                </Link>
                {profile?.is_admin && (
                  <Link to="/admin" className="text-gray-700 hover:text-primary transition">
                    Admin
                  </Link>
                )}
                <Link to="/profile" className="text-gray-700 hover:text-primary transition flex items-center space-x-1">
                  <User size={18} />
                  <span>{profile?.username}</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-gray-700 hover:text-primary transition flex items-center space-x-1"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="text-gray-700 hover:text-primary transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link to="/" className="block text-gray-700 hover:text-primary py-2">
              Browse
            </Link>
            {user ? (
              <>
                <Link to="/create-listing" className="block text-gray-700 hover:text-primary py-2">
                  Sell Item
                </Link>
                <Link to="/cart" className="block text-gray-700 hover:text-primary py-2">
                  Cart
                </Link>
                <Link to="/orders" className="block text-gray-700 hover:text-primary py-2">
                  Orders
                </Link>
                {profile?.is_admin && (
                  <Link to="/admin" className="block text-gray-700 hover:text-primary py-2">
                    Admin
                  </Link>
                )}
                <Link to="/profile" className="block text-gray-700 hover:text-primary py-2">
                  Profile: {profile?.username}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left text-gray-700 hover:text-primary py-2"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="block text-gray-700 hover:text-primary py-2">
                  Sign In
                </Link>
                <Link to="/signup" className="block bg-primary text-white px-4 py-2 rounded">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
