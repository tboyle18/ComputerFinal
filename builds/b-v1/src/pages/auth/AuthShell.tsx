import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { ListingImage } from '../../components/listings/ListingImage'
import { Logo } from '../../components/ui/Logo'
import { ThemeToggleButton } from '../../components/layout/ThemeSwitch'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/utils'

type Mini = { id: string; title: string; price: number; images: string[]; category: string }

export function AuthShell({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const [items, setItems] = useState<Mini[]>([])

  useEffect(() => {
    supabase
      .from('listings')
      .select('id, title, price, images, category')
      .eq('status', 'active')
      .filter('images', 'neq', '{}')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setItems(data ?? []))
  }, [])

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggleButton />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px]"
          >
            <h1 className="text-[32px] leading-tight font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
        <p className="text-center text-xs text-muted">© {new Date().getFullYear()} Trove · Payments on Trove are simulated.</p>
      </div>

      <div className="relative hidden overflow-hidden p-3 lg:block">
        <div className="hero-glow relative h-full overflow-hidden rounded-[32px]">
          <div className="dotted-bg absolute inset-0" />
          <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
            <div className="grid grid-cols-3 gap-3 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.6 }}
                  className={i % 3 === 1 ? 'mt-10' : ''}
                >
                  <div className="rounded-2xl bg-white/[0.06] p-1.5 ring-1 ring-white/10 backdrop-blur">
                    <ListingImage path={item.images[0]} alt="" category={item.category} width={400} className="aspect-[4/5] rounded-xl" />
                    <div className="flex items-center justify-between px-1.5 pt-2 pb-1 text-[12px]">
                      <span className="truncate text-white/70">{item.title}</span>
                      <span className="ml-2 shrink-0 font-semibold text-accent">{formatPrice(item.price)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div>
              <p className="max-w-md text-4xl leading-[1.1] font-semibold tracking-tight">
                Every item has a story.
                <br />
                <span className="font-display font-normal text-accent italic">Give it its next chapter.</span>
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
                Join a community of people who’d rather pass things on than throw them away.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted">
      <div className="h-px flex-1 bg-line" />
      {children}
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}
