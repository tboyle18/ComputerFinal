import { Link } from 'react-router'
import { CATEGORIES } from '../../lib/categories'
import { LogoMark } from '../ui/Logo'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="font-display text-2xl italic">trove</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            A calmer way to buy and sell pre-loved things. Fewer listings that go nowhere, more finds worth keeping.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Shop</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            {CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link to={`/?category=${c.slug}`} className="transition hover:text-ink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Sell</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link to="/sell" className="transition hover:text-ink">List an item</Link></li>
            <li><Link to="/orders?tab=sales" className="transition hover:text-ink">Your sales</Link></li>
            <li><Link to="/messages" className="transition hover:text-ink">Messages</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Account</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link to="/orders" className="transition hover:text-ink">Order history</Link></li>
            <li><Link to="/saved" className="transition hover:text-ink">Saved items</Link></li>
            <li><Link to="/settings" className="transition hover:text-ink">Settings</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Trove Marketplace. Payments are simulated — no real money changes hands.</p>
          <p>Built with React, Supabase & Cloudflare.</p>
        </div>
      </div>
    </footer>
  )
}
