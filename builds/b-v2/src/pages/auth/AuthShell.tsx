import type { ReactNode } from 'react';
import { BadgeCheck, Lock, MessageCircle } from 'lucide-react';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <aside className="hero-glow relative hidden overflow-hidden rounded-[2rem] border border-line bg-surface p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-ink">Curio</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight">
            Buy and sell with people you can <span className="text-brand">trust</span>.
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            Thousands of one-of-a-kind finds, protected messaging and a checkout that keeps your details private.
          </p>
        </div>
        <ul className="mt-10 space-y-4">
          {[
            { icon: Lock, title: 'Private by default', text: 'Your email and address are never shown publicly.' },
            { icon: BadgeCheck, title: 'Two-factor protection', text: 'Lock your account with an authenticator app.' },
            { icon: MessageCircle, title: 'Safe messaging', text: 'Chat with sellers without sharing contact details.' },
          ].map(({ icon: Icon, title: t, text }) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-surface/70 p-4 backdrop-blur">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex items-center justify-center">
        <div className="w-full max-w-md animate-rise">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
