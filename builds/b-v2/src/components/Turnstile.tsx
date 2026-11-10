import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../lib/env';

/**
 * Cloudflare Turnstile (privacy-friendly CAPTCHA) for auth forms.
 *
 * SECURITY: blocks credential-stuffing and sign-up bots. The token is
 * verified by Supabase Auth on the server (CAPTCHA protection setting), so a
 * bot can't just skip this widget. Disabled when no site key is configured.
 */
interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const captchaEnabled = config.turnstileSiteKey !== '';

/** Hook: returns the current token, a reset() and the widget element. */
export function useCaptcha(action: string) {
  const [token, setToken] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setResetCount((n) => n + 1);
  }, []);
  const widget = captchaEnabled ? (
    <TurnstileWidget action={action} onToken={setToken} resetCount={resetCount} />
  ) : null;
  return {
    /** undefined when CAPTCHA is disabled, so it can be passed straight to supabase-js. */
    captchaToken: captchaEnabled ? (token ?? undefined) : undefined,
    ready: !captchaEnabled || !!token,
    reset,
    widget,
  };
}

function TurnstileWidget({
  action,
  onToken,
  resetCount,
}: {
  action: string;
  onToken: (t: string | null) => void;
  resetCount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: config.turnstileSiteKey,
          action,
          theme: 'auto',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action, onToken]);

  useEffect(() => {
    if (resetCount > 0 && widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetCount]);

  if (failed) {
    return <p className="text-sm text-danger">The bot check couldn’t load. Disable content blockers and reload.</p>;
  }
  return <div ref={ref} className="min-h-[65px]" />;
}
