import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/layout/Guards'
import { AppLayout, Layout } from './components/layout/Layout'
import { PageLoader } from './components/ui/Feedback'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { InboxProvider } from './context/InboxContext'
import { SavedProvider } from './context/SavedContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { isSupabaseConfigured } from './lib/supabase'
import Home from './pages/Home'
import SetupRequired from './pages/SetupRequired'

const ListingDetail = lazy(() => import('./pages/ListingDetail'))
const ListingEditor = lazy(() => import('./pages/ListingEditor'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Saved = lazy(() => import('./pages/Saved'))
const Messages = lazy(() => import('./pages/Messages'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      offset={76}
      toastOptions={{
        classNames: {
          toast: '!rounded-2xl !border-line !bg-surface !text-ink !shadow-pop !font-sans',
          description: '!text-muted',
          actionButton: '!bg-ink !text-canvas !rounded-full !font-medium',
        },
      }}
    />
  )
}

/** Everything that needs the router (navigation inside providers) lives here. */
function Root() {
  return (
    <AuthProvider>
      <CartProvider>
        <SavedProvider>
          <InboxProvider>
            <Outlet />
            <ThemedToaster />
          </InboxProvider>
        </SavedProvider>
      </CartProvider>
    </AuthProvider>
  )
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>
const guest = (el: ReactNode) => (
  <GuestOnly>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </GuestOnly>
)

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'listing/:id', element: <ListingDetail /> },
          { path: 'listing/:id/edit', element: auth(<ListingEditor />) },
          { path: 'sell', element: auth(<ListingEditor />) },
          { path: 'u/:username', element: <Profile /> },
          { path: 'settings', element: auth(<Settings />) },
          { path: 'saved', element: auth(<Saved />) },
          { path: 'cart', element: auth(<Cart />) },
          { path: 'orders', element: auth(<Orders />) },
          { path: 'orders/:id', element: auth(<OrderDetail />) },
          { path: 'admin', element: <RequireAdmin><Admin /></RequireAdmin> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: 'messages', element: auth(<Messages />) },
          { path: 'messages/:conversationId', element: auth(<Messages />) },
          { path: 'checkout', element: auth(<Checkout />) },
        ],
      },
      { path: 'login', element: guest(<Login />) },
      { path: 'signup', element: guest(<Signup />) },
      { path: 'forgot-password', element: guest(<ForgotPassword />) },
      {
        path: 'reset-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ResetPassword />
          </Suspense>
        ),
      },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider>
      {isSupabaseConfigured ? <RouterProvider router={router} /> : <SetupRequired />}
    </ThemeProvider>
  )
}
