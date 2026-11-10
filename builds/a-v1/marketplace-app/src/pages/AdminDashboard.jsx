import { useEffect, useState } from 'react';
import { Trash2, Users, Package } from 'lucide-react';
import { supabase } from '../config/supabase';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    totalOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: usersData } = await supabase.from('profiles').select('*');
      const { data: listingsData } = await supabase.from('listings').select('*');
      const { data: ordersData } = await supabase.from('orders').select('id');

      setUsers(usersData || []);
      setListings(listingsData || []);
      setStats({
        totalUsers: usersData?.length || 0,
        totalListings: listingsData?.length || 0,
        totalOrders: ordersData?.length || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Delete this user? This action cannot be undone.')) return;

    try {
      await supabase.from('profiles').delete().eq('id', userId);
      setUsers(users.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  const deleteListing = async (listingId) => {
    if (!confirm('Delete this listing?')) return;

    try {
      await supabase.from('listings').delete().eq('id', listingId);
      setListings(listings.filter(l => l.id !== listingId));
      setStats(prev => ({ ...prev, totalListings: prev.totalListings - 1 }));
    } catch (err) {
      console.error(err);
      alert('Failed to delete listing');
    }
  };

  if (loading) return <div className="loading">Loading admin dashboard...</div>;

  return (
    <div className="admin-container">
      <h1>Admin Dashboard</h1>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          Listings
        </button>
      </div>

      {activeTab === 'stats' && (
        <div className="stats-grid">
          <div className="stat-card">
            <Users size={32} />
            <h3>Total Users</h3>
            <p className="stat-value">{stats.totalUsers}</p>
          </div>
          <div className="stat-card">
            <Package size={32} />
            <h3>Total Listings</h3>
            <p className="stat-value">{stats.totalListings}</p>
          </div>
          <div className="stat-card">
            <Package size={32} />
            <h3>Total Orders</h3>
            <p className="stat-value">{stats.totalOrders}</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section">
          <h2>Manage Users ({users.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Admin</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.is_admin ? '✓' : '-'}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="delete-btn"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="admin-section">
          <h2>Manage Listings ({listings.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => (
                <tr key={listing.id}>
                  <td>{listing.title}</td>
                  <td>{listing.category}</td>
                  <td>${listing.price}</td>
                  <td><span className="status-badge">{listing.status}</span></td>
                  <td>
                    <button
                      onClick={() => deleteListing(listing.id)}
                      className="delete-btn"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
