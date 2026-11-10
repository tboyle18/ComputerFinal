import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { ShoppingCart, Send, ChevronLeft, User } from 'lucide-react'

interface Listing {
  id: number
  title: string
  description: string
  price: number
  category_id: number
  seller_id: string
  created_at: string
  listing_images: Array<{ image_url: string }>
  categories: { name: string }
  user_profiles: { username: string; full_name: string }
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [listing, setListing] = useState<Listing | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadListing()
  }, [id])

  const loadListing = async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error: err } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          description,
          price,
          category_id,
          seller_id,
          created_at,
          listing_images(image_url),
          categories(name),
          user_profiles(username, full_name)
        `)
        .eq('id', parseInt(id || '0'))
        .single()

      if (err) throw err
      setListing(data as any)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load listing'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!user || !listing) {
      navigate('/signin')
      return
    }

    try {
      setAddingToCart(true)
      setError('')

      // Security: User can only add to their own cart
      const { error: err } = await supabase
        .from('cart_items')
        .upsert({
          user_id: user.id,
          listing_id: listing.id,
          quantity: 1,
        })

      if (err) throw err
      setSuccess('Added to cart!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to cart'
      setError(message)
    } finally {
      setAddingToCart(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !listing) {
      navigate('/signin')
      return
    }

    if (!message.trim()) {
      setError('Message cannot be empty')
      return
    }

    // Security: User cannot message themselves
    if (user.id === listing.seller_id) {
      setError('You cannot message yourself')
      return
    }

    try {
      setSendingMessage(true)
      setError('')

      const { error: err } = await supabase
        .from('messages')
        .insert({
          listing_id: listing.id,
          sender_id: user.id,
          recipient_id: listing.seller_id,
          content: message.substring(0, 1000), // Limit message length
        })

      if (err) throw err
      setMessage('')
      setSuccess('Message sent!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message'
      setError(message)
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-primary hover:underline mb-8"
          >
            <ChevronLeft size={20} />
            <span>Back to listings</span>
          </button>
          <div className="text-center">
            <p className="text-red-600">{error || 'Listing not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-primary hover:underline mb-8"
        >
          <ChevronLeft size={20} />
          <span>Back to listings</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Images */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg overflow-hidden shadow-lg mb-4">
              <div className="relative h-96 bg-gray-200">
                {listing.listing_images && listing.listing_images.length > 0 ? (
                  <img
                    src={listing.listing_images[selectedImageIndex].image_url}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-300 text-gray-500 text-xl">
                    No Image
                  </div>
                )}
              </div>

              {listing.listing_images && listing.listing_images.length > 1 && (
                <div className="grid grid-cols-5 gap-2 p-4">
                  {listing.listing_images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative h-20 rounded-lg overflow-hidden border-2 transition ${
                        selectedImageIndex === idx ? 'border-primary' : 'border-gray-300'
                      }`}
                    >
                      <img
                        src={img.image_url}
                        alt={`${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{listing.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Price and Status */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-primary font-medium mb-2">
                {listing.categories.name}
              </p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{listing.title}</h1>
              <p className="text-4xl font-bold text-primary mb-6">
                ${listing.price.toFixed(2)}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {success}
                </div>
              )}

              {user?.id !== listing.seller_id && (
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="w-full bg-primary text-white py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition font-medium flex items-center justify-center space-x-2 mb-3"
                >
                  <ShoppingCart size={20} />
                  <span>{addingToCart ? 'Adding...' : 'Add to Cart'}</span>
                </button>
              )}
            </div>

            {/* Seller Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                <User size={20} />
                <span>Seller</span>
              </h3>
              <p className="font-medium text-gray-900 mb-1">
                {listing.user_profiles.full_name}
              </p>
              <p className="text-gray-600 mb-4">@{listing.user_profiles.username}</p>
              <p className="text-sm text-gray-500 mb-4">
                Listed {new Date(listing.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Message Seller */}
            {user && user.id !== listing.seller_id && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold mb-4">Message Seller</h3>
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask a question about this item..."
                    maxLength={1000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-24"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !message.trim()}
                    className="w-full bg-primary text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition font-medium flex items-center justify-center space-x-2"
                  >
                    <Send size={18} />
                    <span>{sendingMessage ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </form>
              </div>
            )}

            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  Sign in to message the seller or add this item to your cart.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
