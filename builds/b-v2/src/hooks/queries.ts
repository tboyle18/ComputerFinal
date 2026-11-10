import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { getAdminStatus } from '../api/admin';
import { getCart } from '../api/commerce';
import { getUnreadCount } from '../api/messages';
import { supabase } from '../lib/supabase';

export const keys = {
  cart: (uid: string) => ['cart', uid] as const,
  adminStatus: (uid: string) => ['admin-status', uid] as const,
  unread: (uid: string) => ['unread', uid] as const,
  conversations: (uid: string) => ['conversations', uid] as const,
  messages: (cid: string) => ['messages', cid] as const,
  orders: (uid: string, role: 'buyer' | 'seller') => ['orders', uid, role] as const,
  listing: (id: string) => ['listing', id] as const,
  myListings: (uid: string) => ['my-listings', uid] as const,
  profile: (id: string) => ['profile', id] as const,
};

export function useCart() {
  const { user, mfaRequired } = useAuth();
  return useQuery({
    queryKey: keys.cart(user?.id ?? 'anon'),
    queryFn: () => getCart(user!.id),
    enabled: !!user && !mfaRequired,
  });
}

/** Whether to show admin UI. The real check happens server-side on every call. */
export function useAdminStatus() {
  const { user, aal, mfaRequired } = useAuth();
  return useQuery({
    queryKey: [...keys.adminStatus(user?.id ?? 'anon'), aal?.currentLevel],
    queryFn: getAdminStatus,
    enabled: !!user && !mfaRequired,
    staleTime: 5 * 60_000,
  });
}

export function useUnreadCount() {
  const { user, mfaRequired } = useAuth();
  return useQuery({
    queryKey: keys.unread(user?.id ?? 'anon'),
    queryFn: getUnreadCount,
    enabled: !!user && !mfaRequired,
    refetchInterval: 60_000,
  });
}

/**
 * Live "new message" notifications. Realtime enforces RLS per subscriber, so
 * this channel only ever receives messages from the user's own conversations.
 */
export function useMessageNotifications() {
  const { user, mfaRequired } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user || mfaRequired) return;
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { conversation_id?: string };
        void queryClient.invalidateQueries({ queryKey: keys.unread(user.id) });
        void queryClient.invalidateQueries({ queryKey: keys.conversations(user.id) });
        if (row.conversation_id) void queryClient.invalidateQueries({ queryKey: keys.messages(row.conversation_id) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, mfaRequired, queryClient]);
}
