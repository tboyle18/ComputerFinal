import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart } from 'lucide-react';
import { supabase } from '../config/supabase';
import './Home.css';

const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Art'];

export default function Home({ user }) {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    fetchListings();
    if (user) loadFavorites();
  }, [user]);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*, profiles(email)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
      setFilteredListings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const { data } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id);

      if (data) {
        setFavorites(new Set(data.map(f => f.listing_id)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFavorite = async (listingId) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (favorites.has(listingId)) {
        await supabase
          .from('favorites')
          .delete()
          .eq('listing_id', listingId)
          .eq('user_id', user.id);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(listingId);
          return newSet;
        });
      } else {
        await supabase.from('favorites').insert([
          { listing_id: listingId, user_id: user.id }
        ]);
        setFavorites(prev => new Set(prev).add(listingId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let filtered = listings;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(l => l.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(l =>
        l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredListings(filtered);
  }, [searchTerm, selectedCategory, listings]);

  if (loading) return <div className="loading">Loading listings...</div>;

  return (
    <div className="home-container">
      <div className="hero">
        <h1>Find Everything You Need</h1>
        <p>Browse thousands of listings from verified sellers</p>
      </div>

      <div className="search-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="category-filters">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="listings-grid">
        {filteredListings.length === 0 ? (
          <div className="no-results">
            <p>No listings found. {!user && <Link to="/auth">Sign in to create one!</Link>}</p>
          </div>
        ) : (
          filteredListings.map(listing => (
            <div key={listing.id} className="listing-card">
              {listing.image_url && (
                <div className="listing-image">
                  <img src={listing.image_url} alt={listing.title} />
                </div>
              )}
              <div className="listing-badge">{listing.category}</div>
              <button
                className={`favorite-btn ${favorites.has(listing.id) ? 'active' : ''}`}
                onClick={() => toggleFavorite(listing.id)}
              >
                <Heart size={18} fill={favorites.has(listing.id) ? 'currentColor' : 'none'} />
              </button>
              <div className="listing-content">
                <Link to={`/listing/${listing.id}`} className="listing-title">
                  {listing.title}
                </Link>
                <p className="listing-description">{listing.description.substring(0, 60)}...</p>
                <div className="listing-footer">
                  <span className="price">${listing.price}</span>
                  <span className="seller">{listing.profiles?.email?.split('@')[0]}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
