import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * SECURITY: everything prefixed with VITE_ is compiled into the public
 * JavaScript bundle. This plugin fails the build if a secret ever ends up
 * there, e.g. someone pastes the Supabase secret / service_role key into
 * VITE_SUPABASE_PUBLISHABLE_KEY by mistake.
 */
function guardPublicEnv(mode: string): Plugin {
  return {
    name: 'curio:guard-public-env',
    config() {
      const env = loadEnv(mode, '.', 'VITE_');
      for (const [name, value] of Object.entries(env)) {
        if (/SECRET|SERVICE_ROLE|PRIVATE|PASSWORD/i.test(name)) {
          throw new Error(`[security] ${name} looks like a secret and must not use the VITE_ prefix.`);
        }
        if (value.startsWith('sb_secret_')) {
          throw new Error(`[security] ${name} contains a Supabase SECRET key. Use the publishable key.`);
        }
        const jwtPayload = value.split('.')[1];
        if (jwtPayload) {
          try {
            const claims = JSON.parse(Buffer.from(jwtPayload, 'base64url').toString('utf8')) as { role?: string };
            if (claims.role && claims.role !== 'anon') {
              throw new Error(`[security] ${name} is a "${claims.role}" key. Only the publishable/anon key is allowed.`);
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('[security]')) throw err;
          }
        }
      }
      if (mode === 'production') {
        const url = env.VITE_SUPABASE_URL ?? '';
        if (!url.startsWith('https://')) {
          throw new Error('[security] VITE_SUPABASE_URL must be an https:// URL for production builds.');
        }
        if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) {
          throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required.');
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [guardPublicEnv(mode), react(), tailwindcss()],
  build: {
    target: 'es2022',
    // Don't publish source maps: all frontend code is public anyway, but this
    // avoids shipping comments and internal structure to every visitor.
    sourcemap: false,
    // Keep everything as files so the strict CSP (no inline script) holds.
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
}));
