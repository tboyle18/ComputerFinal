import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Package } from 'lucide-react'

interface Order {
  id: number
  buyer_id: string
  seller_id: string
  listing_id: number
  quantity: number
  total_price: number
  status: string
  created_at: string
  listings: { title: string }
  user_profiles: { full_name: string; username: string }
}

export default function Orders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'bought' | 'sold'>('bought')

  useEffect(() => {
    loadOrders()
  }, [user, tab])

  const loadOrders = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          seller_id,
          listing_id,
          quantity,
          total_price,
          status,
          created_at,
          listings(title),
          user_profiles(full_name, username)
        `)

      if (tab === 'bought') {
        query = query.eq('buyer_id', user.id)
      } else {
        query = query.eq('seller_id', user.id)
      }

      const { data, error: err } = await query.order('created_at', { ascending: false })

      if (err) throw err
      setOrders((data as any) || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    if (!window.confirm(`Mark this order as ${newStatus}?`)) return

    try {
      const { error: err } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (err) throw err
      await loadOrders()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order'
      setError(message)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center space-x-2">
          <Package size={32} />
          <span>Orders</span>
        </h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setTab('bought')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              tab === 'bought'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Purchased
          </button>
          <button
            onClick={() => setTab('sold')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              tab === 'sold'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Sold
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Package size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              {tab === 'bought' ? 'You have no purchase orders' : 'You have no sales'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Item</p>
                    <p className="font-bold">{order.listings.title}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">
                      {tab === 'bought' ? 'Seller' : 'Buyer'}
                    </p>
                    <p className="font-bold">{order.user_profiles.full_name}</p>
                    <p className="text-gray-500 text-sm">@{order.user_profiles.username}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Amount</p>
                    <p className="font-bold text-lg text-primary">
                      ${order.total_price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Date</p>
                    <p className="font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                  <div>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                      order.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>

                  {tab === 'sold' && order.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      className="text-primary hover:underline font-medium"
                    >
                      Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
