import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthMFAGetAuthenticatorAssuranceLevelResponse, Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type Aal = NonNullable<AuthMFAGetAuthenticatorAssuranceLevelResponse['data']>;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True when the user has 2FA enrolled but this session hasn't verified it yet. */
  mfaRequired: boolean;
  aal: Aal | null;
  refreshAal: () => Promise<void>;
  signOut: (scope?: 'local' | 'global') => Promise<void>;
  /**
   * Run a re-authentication flow (password, then 2FA code) without the global
   * 2FA gate briefly replacing the current page in between the two steps.
   */
  withReauth: <T>(fn: () => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [aal, setAal] = useState<Aal | null>(null);
  const [loading, setLoading] = useState(true);
  const [reauthenticating, setReauthenticating] = useState(false);

  const refreshAal = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(data ?? null);
  }, []);

  useEffect(() => {
    // undefined = we haven't seen the first auth event yet.
    let currentUserId: string | null | undefined;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // SECURITY: when a signed-in user signs out or is replaced by another
      // account (shared computer), wipe every cached query so one user's
      // orders/messages can never flash up for the next person.
      // resetQueries (not clear) keeps mounted components subscribed so they
      // refetch with the new identity instead of hanging.
      const nextUserId = next?.user.id ?? null;
      if (currentUserId && nextUserId !== currentUserId) {
        void queryClient.resetQueries();
      }
      currentUserId = nextUserId;
      setSession(next);
      // supabase-js warns against awaiting other auth calls inside this
      // callback (it can deadlock), so defer the AAL lookup.
      setTimeout(() => {
        void refreshAal().finally(() => setLoading(false));
      }, 0);
    });

    return () => sub.subscription.unsubscribe();
  }, [queryClient, refreshAal]);

  const signOut = useCallback(
    async (scope: 'local' | 'global' = 'local') => {
      await supabase.auth.signOut({ scope });
      await queryClient.resetQueries();
    },
    [queryClient],
  );

  const withReauth = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setReauthenticating(true);
    try {
      return await fn();
    } finally {
      await refreshAal();
      setReauthenticating(false);
    }
  }, [refreshAal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      aal,
      mfaRequired: !reauthenticating && !!session && aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2',
      refreshAal,
      signOut,
      withReauth,
    }),
    [session, loading, aal, reauthenticating, refreshAal, signOut, withReauth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
