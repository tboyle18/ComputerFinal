import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import './Profile.css';

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;
      setMyListings(listings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteListing = async (id) => {
    if (!confirm('Delete this listing?')) return;

    try {
      await supabase.from('listings').delete().eq('id', id);
      setMyListings(myListings.filter(l => l.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="loading">Loading profile...</div>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-info">
          <h1>{profile?.email?.split('@')[0]}</h1>
          <p>{profile?.email}</p>
          <p className="joined">Member since {new Date(profile?.created_at).toLocaleDateString()}</p>
        </div>
        <div className="profile-stats">
          <div className="stat">
            <strong>{myListings.length}</strong>
            <span>Listings</span>
          </div>
        </div>
      </div>

      <div className="my-listings">
        <h2>My Listings</h2>
        {myListings.length === 0 ? (
          <p className="empty">No listings yet. <a href="/create">Create your first listing</a></p>
        ) : (
          <div className="listings-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myListings.map(listing => (
                  <tr key={listing.id}>
                    <td>{listing.title}</td>
                    <td>${listing.price}</td>
                    <td>{listing.category}</td>
                    <td><span className="status">{listing.status}</span></td>
                    <td>
                      <a href={`/listing/${listing.id}`} className="action-link">View</a>
                      <button
                        onClick={() => deleteListing(listing.id)}
                        className="action-btn delete"
                      >
                        Delete
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
  );
}
