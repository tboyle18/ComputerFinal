import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './config/supabase';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import Cart from './pages/Cart';
import OrderHistory from './pages/OrderHistory';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(profile?.is_admin || false);
      }

      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(profile?.is_admin || false);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      {user && <Navigation user={user} isAdmin={isAdmin} />}
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/auth" element={user ? <Navigate to="/" /> : <Auth />} />
        <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/auth" />} />
        <Route path="/listing/:id" element={<ListingDetail user={user} />} />
        <Route path="/create" element={user ? <CreateListing user={user} /> : <Navigate to="/auth" />} />
        <Route path="/cart" element={user ? <Cart user={user} /> : <Navigate to="/auth" />} />
        <Route path="/orders" element={user ? <OrderHistory user={user} /> : <Navigate to="/auth" />} />
        <Route path="/admin" element={isAdmin ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
