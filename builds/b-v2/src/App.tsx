import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { RedirectIfAuthed, RequireAuth } from './auth/guards';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { PageLoader } from './components/ui';

// Route-level code splitting: visitors only download what they use.
const page = <T extends object>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[name] as unknown as React.ComponentType })));

const ListingDetail = page(() => import('./pages/ListingDetail'), 'ListingDetail');
const ListingEditor = page(() => import('./pages/ListingEditor'), 'ListingEditor');
const PublicProfile = page(() => import('./pages/Profile'), 'PublicProfile');
const Selling = page(() => import('./pages/Selling'), 'Selling');
const Cart = page(() => import('./pages/Cart'), 'Cart');
const Checkout = page(() => import('./pages/Checkout'), 'Checkout');
const CheckoutSuccess = page(() => import('./pages/Orders'), 'CheckoutSuccess');
const Orders = page(() => import('./pages/Orders'), 'Orders');
const Sales = page(() => import('./pages/Orders'), 'Sales');
const Messages = page(() => import('./pages/Messages'), 'Messages');
const Account = page(() => import('./pages/Account'), 'Account');
const Admin = page(() => import('./pages/Admin'), 'Admin');
const Login = page(() => import('./pages/auth/Login'), 'Login');
const Signup = page(() => import('./pages/auth/Signup'), 'Signup');
const ForgotPassword = page(() => import('./pages/auth/RecoveryPages'), 'ForgotPassword');
const ResetPassword = page(() => import('./pages/auth/RecoveryPages'), 'ResetPassword');
const AuthCallback = page(() => import('./pages/auth/RecoveryPages'), 'AuthCallback');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't hammer the API retrying requests that were refused on purpose
      // (permissions, validation, rate limits); only retry likely-transient failures.
      retry: (count, error) => {
        const code = (error as { code?: string }).code ?? '';
        if (/^(PT|P0|42|23|PGRST)/.test(code)) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});

const suspense = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;
const auth = (el: React.ReactNode) => <RequireAuth>{suspense(el)}</RequireAuth>;
const guest = (el: React.ReactNode) => <RedirectIfAuthed>{suspense(el)}</RedirectIfAuthed>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/listing/:id', element: suspense(<ListingDetail />) },
      { path: '/listing/:id/edit', element: auth(<ListingEditor />) },
      { path: '/sell', element: auth(<ListingEditor />) },
      { path: '/u/:id', element: suspense(<PublicProfile />) },
      { path: '/selling', element: auth(<Selling />) },
      { path: '/cart', element: auth(<Cart />) },
      { path: '/checkout', element: auth(<Checkout />) },
      { path: '/checkout/success/:id', element: auth(<CheckoutSuccess />) },
      { path: '/orders', element: auth(<Orders />) },
      { path: '/sales', element: auth(<Sales />) },
      { path: '/messages', element: auth(<Messages />) },
      { path: '/messages/:id', element: auth(<Messages />) },
      { path: '/account', element: auth(<Account />) },
      { path: '/admin', element: auth(<Admin />) },
      { path: '/login', element: guest(<Login />) },
      { path: '/signup', element: guest(<Signup />) },
      { path: '/forgot-password', element: guest(<ForgotPassword />) },
      { path: '/reset-password', element: suspense(<ResetPassword />) },
      { path: '/auth/callback', element: suspense(<AuthCallback />) },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
