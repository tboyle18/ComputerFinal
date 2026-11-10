import { supabase } from '../lib/supabase';

export async function getConversations() {
  // RLS returns only conversations the caller takes part in.
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, listing_id, listing_title, buyer_id, seller_id, last_message_at, last_message_preview, last_message_sender_id, buyer_last_read_at, seller_last_read_at, buyer:profiles!conversations_buyer_fkey(id, display_name, avatar_path), seller:profiles!conversations_seller_fkey(id, display_name, avatar_path), listing:listings(id, image_paths, status, price_cents)',
    )
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
export type Conversation = Awaited<ReturnType<typeof getConversations>>[number];

export function isUnread(c: Conversation, userId: string): boolean {
  if (!c.last_message_sender_id || c.last_message_sender_id === userId) return false;
  const lastRead = c.buyer_id === userId ? c.buyer_last_read_at : c.seller_last_read_at;
  return new Date(c.last_message_at) > new Date(lastRead);
}

export const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at' as const;
export interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  // sender_id is filled by the database from the session; RLS checks membership.
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, body })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function startConversation(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { p_listing_id: listingId });
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_conversation_count');
  if (error) throw error;
  return data ?? 0;
}
