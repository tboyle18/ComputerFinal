import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import './OrderHistory.css';

export default function OrderHistory({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [user]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, listings(title, price))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="orders-container">
      <h1>Order History</h1>

      {orders.length === 0 ? (
        <div className="empty-orders">
          <p>No orders yet. <a href="/">Start shopping!</a></p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-info">
                  <p className="order-id">Order #{order.id.substring(0, 8)}</p>
                  <p className="order-date">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div className="order-status">
                  <span className={`status-badge ${order.status}`}>{order.status}</span>
                </div>
              </div>

              <div className="order-items">
                {order.order_items?.map((item, idx) => (
                  <div key={idx} className="order-item-row">
                    <span className="item-name">{item.listings?.title}</span>
                    <span className="item-qty">x{item.quantity}</span>
                    <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="order-total">
                <span>Total:</span>
                <span className="total-amount">${order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
