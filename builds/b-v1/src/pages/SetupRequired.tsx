import { Database, KeyRound } from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'

/** Shown when the Supabase environment variables are missing. */
export default function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-lift">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <h1 className="font-display text-3xl italic">trove</h1>
            <p className="text-sm text-muted">Almost there — connect your Supabase project.</p>
          </div>
        </div>
        <ol className="mt-8 space-y-5 text-sm leading-relaxed">
          <li className="flex gap-3">
            <Database className="mt-0.5 size-5 shrink-0 text-muted" />
            <span>
              Run <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">supabase/migrations/…_trove_schema.sql</code> in
              your project's SQL editor (and optionally <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">supabase/seed.sql</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted" />
            <span>
              Create <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">.env.local</code> with:
              <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-canvas">
{`VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
              </pre>
              Then restart <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">npm run dev</code>. On Cloudflare, add the
              same variables to the build settings and redeploy.
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
