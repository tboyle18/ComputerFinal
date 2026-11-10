import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Mail, Share2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import './ListingDetail.css';

export default function ListingDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageStatus, setMessageStatus] = useState('');

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*, profiles(email, id)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setListing(data);
      setSeller(data.profiles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      await supabase.from('cart_items').insert([
        { user_id: user.id, listing_id: id, quantity: 1 }
      ]);
      alert('Added to cart!');
      navigate('/cart');
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!message.trim()) return;

    try {
      await supabase.from('messages').insert([
        {
          sender_id: user.id,
          receiver_id: seller.id,
          listing_id: id,
          content: message
        }
      ]);
      setMessage('');
      setMessageStatus('Message sent!');
      setTimeout(() => setMessageStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setMessageStatus('Failed to send message');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!listing) return <div className="error">Listing not found</div>;

  return (
    <div className="listing-detail-container">
      <div className="listing-detail-main">
        <div className="listing-detail-image">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} />
          ) : (
            <div className="no-image">No image</div>
          )}
        </div>

        <div className="listing-detail-content">
          <h1>{listing.title}</h1>
          <p className="category">{listing.category}</p>
          <p className="price">${listing.price}</p>

          <div className="description">
            <h3>Description</h3>
            <p>{listing.description}</p>
          </div>

          <div className="seller-info">
            <h3>About the Seller</h3>
            <p>{seller?.email}</p>
          </div>

          <div className="actions">
            <button className="btn-add-cart" onClick={addToCart}>
              <ShoppingCart size={18} /> Add to Cart
            </button>
            <button className="btn-share">
              <Share2 size={18} /> Share
            </button>
          </div>
        </div>
      </div>

      <div className="message-section">
        <h3>Message the Seller</h3>
        <form onSubmit={sendMessage}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask the seller a question..."
            rows="5"
          />
          {messageStatus && <p className={messageStatus.includes('sent') ? 'success' : 'error'}>{messageStatus}</p>}
          <button type="submit" className="btn-send-message">
            <Mail size={18} /> Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
