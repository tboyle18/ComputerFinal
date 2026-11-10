/**
 * SECURITY: prevent open redirects. `?next=` values come from the URL and
 * could be crafted by an attacker (e.g. `?next=https://evil.example` or
 * `?next=//evil.example`). Only same-origin relative paths are accepted.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (url.pathname.startsWith('/auth/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Absolute URL on this site, for auth email redirect links. */
export function siteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
