import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, LogOut, Settings } from 'lucide-react';
import { supabase } from '../config/supabase';
import './Navigation.css';

export default function Navigation({ user, isAdmin }) {
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="logo">
          <span className="logo-text">🛍️ HaikuMart</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Browse
          </Link>
          <Link to="/create" className={location.pathname === '/create' ? 'active' : ''}>
            Sell
          </Link>
          <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>
            Orders
          </Link>
          {isAdmin && (
            <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
              <Settings size={18} /> Admin
            </Link>
          )}
        </div>

        <div className="nav-right">
          <Link to="/cart" className="cart-icon">
            <ShoppingCart size={20} />
          </Link>
          <Link to="/profile" className="profile-link">
            {user?.email?.split('@')[0]}
          </Link>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
