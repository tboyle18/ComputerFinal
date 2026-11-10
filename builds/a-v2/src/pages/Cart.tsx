import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Trash2, ShoppingBag } from 'lucide-react'

interface CartItem {
  id: number
  listing_id: number
  quantity: number
  listings: {
    title: string
    price: number
    seller_id: string
  }
}

export default function Cart() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCart()
  }, [user])

  const loadCart = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError('')

      const { data, error: err } = await supabase
        .from('cart_items')
        .select(`
          id,
          listing_id,
          quantity,
          listings(title, price, seller_id)
        `)
        .eq('user_id', user.id)

      if (err) throw err
      setItems(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load cart'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveItem = async (cartId: number) => {
    try {
      const { error: err } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartId)
        .eq('user_id', user?.id)

      if (err) throw err
      setItems(items.filter((item) => item.id !== cartId))
      setSuccess('Item removed from cart')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove item'
      setError(message)
    }
  }

  const handleCheckout = async () => {
    if (!user || items.length === 0) return

    try {
      setCheckingOut(true)
      setError('')

      // Security: Group items by seller and create orders
      const ordersBySeller: Record<string, CartItem[]> = {}

      items.forEach((item) => {
        const sellerId = item.listings.seller_id
        if (!ordersBySeller[sellerId]) {
          ordersBySeller[sellerId] = []
        }
        ordersBySeller[sellerId].push(item)
      })

      // Create orders for each seller
      const orders = Object.entries(ordersBySeller).map(([sellerId, sellerItems]: [string, any]) => {
        return sellerItems.map((item: any) => ({
          buyer_id: user.id,
          seller_id: sellerId,
          listing_id: item.listing_id,
          quantity: item.quantity,
          total_price: item.listings.price * item.quantity,
          status: 'pending',
        }))
      }).flat()

      const { error: orderError } = await supabase
        .from('orders')
        .insert(orders)

      if (orderError) throw orderError

      // Clear cart
      const cartIds = items.map((item) => item.id)
      const { error: clearError } = await supabase
        .from('cart_items')
        .delete()
        .in('id', cartIds)
        .eq('user_id', user.id)

      if (clearError) throw clearError

      setSuccess('Order placed successfully!')
      setItems([])
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed'
      setError(message)
    } finally {
      setCheckingOut(false)
    }
  }

  const total = items.reduce(
    (sum, item) => sum + item.listings.price * item.quantity,
    0
  )

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center space-x-2">
          <ShoppingBag size={32} />
          <span>Shopping Cart</span>
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-8">
            {success}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <ShoppingBag size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Your cart is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-200 p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {item.listings.title}
                        </h3>
                        <p className="text-gray-600 mt-1">
                          Qty: {item.quantity}
                        </p>
                        <p className="text-primary font-bold text-lg mt-2">
                          ${(item.listings.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-800 transition flex items-center space-x-1"
                      >
                        <Trash2 size={18} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 h-fit">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600">FREE</span>
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full bg-primary text-white py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition font-medium"
              >
                {checkingOut ? 'Processing...' : 'Proceed to Checkout'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                This is a simulated payment. No real charge will be made.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
