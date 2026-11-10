import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import {
  getConversations,
  getMessages,
  isUnread,
  markConversationRead,
  sendMessage,
  type Conversation,
  type Message,
} from '../api/messages';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { formatPrice, isUuid, timeAgo } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { MESSAGE_MAX } from '../lib/validation';
import { useToast } from '../components/Toast';
import { Alert, Avatar, ButtonLink, EmptyState, Spinner, cx } from '../components/ui';

export function Messages() {
  const { id } = useParams();
  const { user } = useAuth();
  const activeId = isUuid(id) ? id : null;
  const { data: conversations, isPending, isError, error } = useQuery({
    queryKey: keys.conversations(user!.id),
    queryFn: getConversations,
  });
  const active = conversations?.find((c) => c.id === activeId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-0 sm:px-6 sm:py-8">
      <div className="card flex h-[calc(100dvh-4rem)] overflow-hidden rounded-none border-x-0 sm:h-[calc(100dvh-10rem)] sm:min-h-[560px] sm:rounded-3xl sm:border-x">
        {/* Conversation list */}
        <aside className={cx('w-full shrink-0 flex-col border-r border-line md:flex md:w-[340px]', activeId ? 'hidden' : 'flex')}>
          <div className="border-b border-line px-5 py-4">
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isPending ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : isError ? (
              <div className="p-4">
                <Alert tone="danger">{friendlyError(error)}</Alert>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">
                No conversations yet. Message a seller from any listing to start one.
              </div>
            ) : (
              <ul>
                {conversations.map((c) => (
                  <ConversationRow key={c.id} c={c} active={c.id === activeId} />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cx('min-w-0 flex-1 flex-col', activeId ? 'flex' : 'hidden md:flex')}>
          {active ? (
            <Thread conversation={active} />
          ) : activeId && !isPending ? (
            <div className="flex flex-1 items-center justify-center p-6 text-muted">Conversation not found.</div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<MessageCircle className="size-7" />} title="Your inbox" action={<ButtonLink to="/" variant="outline">Browse listings</ButtonLink>}>
                Pick a conversation, or message a seller from a listing.
              </EmptyState>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function otherParty(c: Conversation, userId: string) {
  return c.buyer_id === userId ? c.seller : c.buyer;
}

function ConversationRow({ c, active }: { c: Conversation; active: boolean }) {
  const { user } = useAuth();
  const other = otherParty(c, user!.id);
  const unread = isUnread(c, user!.id);
  const img = imageUrl('listing-images', c.listing?.image_paths[0]);
  return (
    <li>
      <Link
        to={`/messages/${c.id}`}
        className={cx(
          'flex items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors',
          active ? 'bg-brand-soft/60' : 'hover:bg-surface-2/70',
        )}
      >
        <div className="relative">
          <Avatar name={other?.display_name ?? '?'} path={other?.avatar_path} size={44} />
          {img && (
            <img src={img} alt="" className="absolute -bottom-1 -right-1 size-6 rounded-md object-cover ring-2 ring-surface" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cx('truncate text-sm', unread ? 'font-bold' : 'font-semibold')}>{other?.display_name ?? 'Deleted user'}</p>
            <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at)}</span>
          </div>
          <p className="truncate text-xs text-muted">{c.listing_title}</p>
          <p className={cx('mt-0.5 truncate text-sm', unread ? 'font-medium text-ink' : 'text-muted')}>
            {c.last_message_sender_id === user!.id && 'You: '}
            {c.last_message_preview || 'No messages yet'}
          </p>
        </div>
        {unread && <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
      </Link>
    </li>
  );
}

function Thread({ conversation: c }: { conversation: Conversation }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const other = otherParty(c, user!.id);
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesKey = keys.messages(c.id);

  const { data: messages, isPending } = useQuery({ queryKey: messagesKey, queryFn: () => getMessages(c.id) });

  // Live updates for this thread (RLS-filtered by Supabase Realtime).
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${c.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${c.id}` },
        (payload) => {
          const m = payload.new as Message;
          queryClient.setQueryData<Message[]>(messagesKey, (old) =>
            old && !old.some((x) => x.id === m.id) ? [...old, m] : old,
          );
          // The thread is open, so it's read: update the badge afterwards.
          void markConversationRead(c.id).then(() => {
            void queryClient.invalidateQueries({ queryKey: ['unread'] });
            void queryClient.invalidateQueries({ queryKey: ['conversations'] });
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [c.id, queryClient]); // messagesKey is derived from c.id

  // Mark as read when opened.
  useEffect(() => {
    void markConversationRead(c.id).then(() => {
      void queryClient.invalidateQueries({ queryKey: keys.unread(user!.id) });
      void queryClient.invalidateQueries({ queryKey: keys.conversations(user!.id) });
    });
  }, [c.id, queryClient, user]);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: (text: string) => sendMessage(c.id, text),
    onSuccess: (m) => {
      setBody('');
      queryClient.setQueryData<Message[]>(messagesKey, (old) => (old && !old.some((x) => x.id === m.id) ? [...old, m] : old));
      void queryClient.invalidateQueries({ queryKey: keys.conversations(user!.id) });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || text.length > MESSAGE_MAX || send.isPending) return;
    send.mutate(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const listingImg = imageUrl('listing-images', c.listing?.image_paths[0]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <button onClick={() => navigate('/messages')} className="rounded-full p-2 hover:bg-surface-2 md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={other?.display_name ?? '?'} path={other?.avatar_path} size={40} />
        <div className="min-w-0 flex-1">
          {other ? (
            <Link to={`/u/${other.id}`} className="block truncate font-semibold hover:text-brand-ink">
              {other.display_name}
            </Link>
          ) : (
            <p className="font-semibold text-muted">Deleted user</p>
          )}
          <p className="text-xs text-muted">{c.buyer_id === user!.id ? 'Seller' : 'Interested buyer'}</p>
        </div>
        {c.listing_id && (
          <Link
            to={`/listing/${c.listing_id}`}
            className="hidden items-center gap-3 rounded-2xl border border-line py-1.5 pl-1.5 pr-4 transition hover:bg-surface-2 sm:flex"
          >
            <span className="size-10 overflow-hidden rounded-xl bg-surface-2">
              {listingImg ? <img src={listingImg} alt="" className="size-full object-cover" /> : <ImageOff className="m-auto mt-3 size-4 text-muted" />}
            </span>
            <span className="max-w-48">
              <span className="block truncate text-sm font-medium">{c.listing_title}</span>
              {c.listing && (
                <span className="text-xs text-muted">
                  {formatPrice(c.listing.price_cents)} · {c.listing.status === 'active' ? 'Available' : c.listing.status === 'sold' ? 'Sold' : 'Unavailable'}
                </span>
              )}
            </span>
          </Link>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-bg/50 px-4 py-5 sm:px-6">
        <div className="mx-auto mb-4 flex max-w-md items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-xs text-warning">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            Keep payments on Curio. Never share passwords, card numbers or one-time codes. We will never ask for them.
          </span>
        </div>
        {isPending ? (
          <div className="flex justify-center pt-10">
            <Spinner />
          </div>
        ) : (
          messages?.map((m, i) => {
            const mine = m.sender_id === user!.id;
            const prev = messages[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60_000;
            return (
              <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start', !grouped && 'pt-2')}>
                <div
                  className={cx(
                    'max-w-[78%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-snug',
                    mine ? 'rounded-br-lg bg-brand text-white' : 'rounded-bl-lg border border-line bg-surface text-ink',
                  )}
                  title={new Date(m.created_at).toLocaleString()}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="border-t border-line p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-1.5 pl-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder={`Message ${other?.display_name ?? ''}`}
            aria-label="Write a message"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] focus:outline-none field-sizing-content"
          />
          <button
            type="submit"
            disabled={!body.trim() || send.isPending}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover disabled:opacity-40"
            aria-label="Send"
          >
            {send.isPending ? <Spinner className="size-4 text-white" /> : <Send className="size-4" />}
          </button>
        </div>
        {body.length > MESSAGE_MAX - 200 && (
          <p className="mt-1 pr-2 text-right text-xs text-muted">
            {body.length}/{MESSAGE_MAX}
          </p>
        )}
      </form>
    </>
  );
}
