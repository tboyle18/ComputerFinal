import { motion } from 'motion/react'
import { Suspense } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { PageLoader } from '../ui/Feedback'
import { Footer } from './Footer'
import { MobileTabBar } from './MobileTabBar'
import { Navbar } from './Navbar'

/** Main chrome: navbar, page content, footer, and the mobile tab bar. */
export function Layout({ bare = false }: { bare?: boolean }) {
  const location = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
      {!bare && <Footer />}
      <MobileTabBar />
      <ScrollRestoration />
    </div>
  )
}

/** Full-height app layout without footer (messages, checkout). */
export function AppLayout() {
  return <Layout bare />
}

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}
