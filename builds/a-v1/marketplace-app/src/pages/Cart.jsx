import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import './Cart.css';

export default function Cart({ user }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    loadCartItems();
  }, [user]);

  const loadCartItems = async () => {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, listings(id, title, price, image_url)')
        .eq('user_id', user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (cartItemId) => {
    try {
      await supabase.from('cart_items').delete().eq('id', cartItemId);
      setCartItems(cartItems.filter(item => item.id !== cartItemId));
    } catch (err) {
      console.error(err);
    }
  };

  const checkout = async () => {
    setCheckoutLoading(true);
    try {
      const order = {
        user_id: user.id,
        total_amount: totalPrice,
        status: 'completed'
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single();

      if (orderError) throw orderError;

      for (const item of cartItems) {
        await supabase.from('order_items').insert([
          {
            order_id: orderData.id,
            listing_id: item.listing_id,
            quantity: item.quantity,
            price: item.listings.price
          }
        ]);

        await supabase
          .from('listings')
          .update({ status: 'sold' })
          .eq('id', item.listing_id);
      }

      await supabase.from('cart_items').delete().eq('user_id', user.id);
      setCartItems([]);
      alert('Order placed successfully!');
    } catch (err) {
      console.error(err);
      alert('Checkout failed: ' + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading cart...</div>;

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.listings.price * item.quantity), 0);

  return (
    <div className="cart-container">
      <h1>Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <div className="empty-cart">
          <p>Your cart is empty</p>
          <a href="/">Continue Shopping</a>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                {item.listings.image_url && (
                  <img src={item.listings.image_url} alt={item.listings.title} />
                )}
                <div className="item-details">
                  <h3>{item.listings.title}</h3>
                  <p className="price">${item.listings.price}</p>
                  <p className="quantity">Qty: {item.quantity}</p>
                </div>
                <div className="item-subtotal">
                  <p className="subtotal">${(item.listings.price * item.quantity).toFixed(2)}</p>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="remove-btn"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping:</span>
              <span>$0.00</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <button
              className="checkout-btn"
              onClick={checkout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Processing...' : 'Proceed to Checkout'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
