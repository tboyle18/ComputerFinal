/**
 * Curio edge Worker (Cloudflare).
 *
 * Serves the built React app from Workers Static Assets and adds security
 * headers to EVERY response. It holds no secrets and talks to nothing else:
 * the browser talks to Supabase directly, protected by RLS.
 *
 * SECURITY decisions:
 * - Strict Content-Security-Policy: scripts only from this origin (no inline
 *   script, no eval), network calls only to this origin + the Supabase
 *   project, images only from here + Supabase Storage. This is the main defence
 *   against XSS stealing a user's session token.
 * - frame-ancestors 'none' + X-Frame-Options: DENY: no clickjacking.
 * - HSTS: browsers refuse to talk to the site over plain HTTP.
 * - Permissions-Policy: camera, mic, geolocation, payment etc. are disabled.
 * - Fail closed: if SUPABASE_URL is misconfigured, return an error instead of
 *   serving the app without a working CSP.
 */

interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  TURNSTILE_ENABLED?: string;
}

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
let cachedPolicy: { key: string; value: string } | null = null;

function buildCsp(env: Env): string | null {
  const key = `${env.SUPABASE_URL}|${env.TURNSTILE_ENABLED}`;
  if (cachedPolicy?.key === key) return cachedPolicy.value;

  let supabase: URL;
  try {
    supabase = new URL(env.SUPABASE_URL);
  } catch {
    return null;
  }
  const isLocal = supabase.hostname === '127.0.0.1' || supabase.hostname === 'localhost';
  if (supabase.protocol !== 'https:' && !isLocal) return null;

  const api = supabase.origin;
  const ws = api.replace(/^http/, 'ws');
  const turnstile = env.TURNSTILE_ENABLED === 'true' ? ` ${TURNSTILE_ORIGIN}` : '';

  const directives = [
    `default-src 'none'`,
    `script-src 'self'${turnstile}`,
    `style-src 'self'`,
    `img-src 'self' data: blob: ${api}`,
    `font-src 'self'`,
    `connect-src 'self' ${api} ${ws}`,
    `frame-src${turnstile || " 'none'"}`,
    `manifest-src 'self'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    ...(isLocal ? [] : ['upgrade-insecure-requests']),
  ];
  const value = directives.join('; ');
  cachedPolicy = { key, value };
  return value;
}

function applySecurityHeaders(headers: Headers, csp: string): void {
  headers.set('Content-Security-Policy', csp);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()',
  );
  headers.delete('Server');
  headers.delete('X-Powered-By');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const csp = buildCsp(env);
    if (!csp) {
      return new Response('Server misconfigured: SUPABASE_URL must be an https:// URL.', { status: 500 });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    applySecurityHeaders(response.headers, csp);

    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/assets/')) {
      // Vite fingerprints these files, so they can be cached forever.
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // HTML must be revalidated so security fixes reach users immediately.
      response.headers.set('Cache-Control', 'no-cache');
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
