import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { config } from './env';

/**
 * The one and only Supabase client.
 *
 * SECURITY:
 * - Uses the PUBLISHABLE key only. What a user can do is decided entirely by
 *   Row Level Security and grants in the database, never by this frontend.
 * - PKCE flow: email confirmation / password-reset links carry a one-time
 *   code that can only be exchanged by the browser that requested it, instead
 *   of putting tokens in the URL.
 * - Sessions live in localStorage so supabase-js can refresh them. The strict
 *   CSP served by the Worker (no inline or third-party script) is what keeps
 *   XSS from reading them, and access tokens are short-lived (15 min).
 */
export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
