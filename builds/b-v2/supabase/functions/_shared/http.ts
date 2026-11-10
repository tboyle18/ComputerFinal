// Shared HTTP helpers for Curio Edge Functions.
//
// SECURITY: CORS is an allow-list, not "*". Only origins listed in the
// ALLOWED_ORIGINS secret (comma-separated, exact match) get CORS headers, so a
// random website can't drive these endpoints from a victim's browser. CORS is
// defence in depth: every request is still authenticated and authorised below.

const allowedOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
    'Access-Control-Max-Age': '600',
  };
  const origin = req.headers.get('Origin');
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function errorResponse(req: Request, status: number, message: string): Response {
  return json(req, { error: message }, status);
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Reject browsers calling from origins we don't recognise. */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin');
  // Non-browser clients (no Origin header) are still subject to full auth.
  return origin === null || allowedOrigins.has(origin);
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(header);
  return match ? match[1] : null;
}

/** Parse a small JSON body defensively (size-capped, object-only). */
export async function readJsonObject(req: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
