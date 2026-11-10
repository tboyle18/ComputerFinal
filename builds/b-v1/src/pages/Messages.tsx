import { ArrowLeft, ArrowUp, CheckCheck, MessagesSquare, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ListingImage } from '../components/listings/ListingImage'
import { Avatar } from '../components/ui/Avatar'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState, Skeleton, Spinner } from '../components/ui/Feedback'
import { useAuth } from '../context/AuthContext'
import { useInbox } from '../context/InboxContext'
import { supabase } from '../lib/supabase'
import type { Conversation, Listing, Message, SellerSummary } from '../lib/types'
import { cn, displayName, errorMessage, formatPrice, shortTime } from '../lib/utils'

type ConversationRow = Conversation & {
  listing: Pick<Listing, 'id' | 'title' | 'price' | 'images' | 'status' | 'category'> | null
  buyer: SellerSummary | null
  seller: SellerSummary | null
}

type LocalMessage = Message & { pending?: boolean }

const CONVERSATION_SELECT =
  '*, listing:listings(id, title, price, images, status, category), buyer:profiles!conversations_buyer_id_fkey(id, username, full_name, avatar_url), seller:profiles!conversations_seller_id_fkey(id, username, full_name, avatar_url)'

export default function Messages() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const { onMessage, refreshUnread } = useInbox()
  const navigate = useNavigate()
  const me = user!.id

  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [unreadBy, setUnreadBy] = useState<Record<string, number>>({})
  const [loadingList, setLoadingList] = useState(true)
  const [filter, setFilter] = useState('')

  const loadConversations = useCallback(async () => {
    const [{ data }, { data: unread }] = await Promise.all([
      supabase.from('conversations').select(CONVERSATION_SELECT).order('last_message_at', { ascending: false }),
      supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', me),
    ])
    setConversations((data ?? []) as unknown as ConversationRow[])
    const map: Record<string, number> = {}
    for (const m of unread ?? []) map[m.conversation_id] = (map[m.conversation_id] ?? 0) + 1
    setUnreadBy(map)
    setLoadingList(false)
  }, [me])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Keep the inbox list fresh as messages arrive anywhere.
  const activeRef = useRef(conversationId)
  useEffect(() => {
    activeRef.current = conversationId
  }, [conversationId])
  useEffect(
    () =>
      onMessage((msg) => {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.conversation_id)
          if (idx === -1) {
            loadConversations()
            return prev
          }
          const updated = { ...prev[idx], last_message: msg.body, last_message_at: msg.created_at }
          return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
        })
        if (msg.sender_id !== me && msg.conversation_id !== activeRef.current) {
          setUnreadBy((u) => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] ?? 0) + 1 }))
        }
      }),
    [onMessage, me, loadConversations],
  )

  const active = conversations.find((c) => c.id === conversationId) ?? null

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const other = c.buyer_id === me ? c.seller : c.buyer
      return [displayName(other), other?.username, c.listing?.title, c.last_message].some((s) => s?.toLowerCase().includes(q))
    })
  }, [conversations, filter, me])

  return (
    <div className="mx-auto h-[calc(100dvh-216px)] max-w-7xl px-0 sm:px-6 md:h-[calc(100dvh-64px)] md:py-5 lg:px-8">
      <div className="grid h-full overflow-hidden border-line bg-surface sm:rounded-3xl sm:border md:grid-cols-[340px_1fr] md:shadow-soft">
        {/* Conversation list */}
        <aside className={cn('flex min-h-0 flex-col border-line md:border-r', conversationId && 'max-md:hidden')}>
          <div className="border-b border-line p-4">
            <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-ink/10"
              />
            </div>
          </div>
          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="size-12 shrink-0 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-full" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <MessagesSquare className="mx-auto size-8 text-muted" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium">{filter ? 'No matches' : 'No conversations yet'}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {filter ? 'Try a different name or item.' : 'Message a seller from any listing to start chatting.'}
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const other = c.buyer_id === me ? c.seller : c.buyer
                const unread = unreadBy[c.id] ?? 0
                const selected = c.id === conversationId
                return (
                  <Link
                    key={c.id}
                    to={`/messages/${c.id}`}
                    className={cn(
                      'flex gap-3 rounded-2xl p-3 transition-colors',
                      selected ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <div className="relative shrink-0">
                      <ListingImage path={c.listing?.images[0]} alt="" category={c.listing?.category} width={120} className="size-12 rounded-xl" />
                      <Avatar
                        src={other?.avatar_url}
                        name={displayName(other)}
                        seed={other?.id}
                        size={24}
                        className="absolute -right-1.5 -bottom-1.5 ring-2 ring-surface"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{displayName(other)}</p>
                        <span className="shrink-0 text-[11px] text-muted">{shortTime(c.last_message_at)}</span>
                      </div>
                      <p className="truncate text-[12px] text-muted">{c.listing?.title ?? 'Listing removed'}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn('flex-1 truncate text-[13px]', unread ? 'font-medium text-ink' : 'text-muted')}>
                          {c.last_message ?? 'No messages yet'}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn('flex min-h-0 flex-col', !conversationId && 'max-md:hidden')}>
          {conversationId ? (
            active ? (
              <Thread
                key={active.id}
                conversation={active}
                me={me}
                onBack={() => navigate('/messages')}
                onRead={() => {
                  setUnreadBy((u) => ({ ...u, [active.id]: 0 }))
                  refreshUnread()
                }}
              />
            ) : loadingList ? (
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={MessagesSquare} title="Conversation not found" action={<ButtonLink to="/messages">Back to inbox</ButtonLink>} />
              </div>
            )
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center p-10 text-center md:flex">
              <div className="relative">
                <div className="absolute inset-0 scale-150 rounded-full bg-accent/30 blur-2xl" />
                <div className="relative flex size-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft">
                  <MessagesSquare className="size-7" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="mt-6 text-lg font-semibold tracking-tight">Your conversations</h2>
              <p className="mt-1.5 max-w-xs text-sm text-muted">Pick a chat on the left, or message a seller from any listing to ask a question.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function dayLabel(date: string) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function Thread({
  conversation,
  me,
  onBack,
  onRead,
}: {
  conversation: ConversationRow
  me: string
  onBack: () => void
  onRead: () => void
}) {
  const { onMessage } = useInbox()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const other = conversation.buyer_id === me ? conversation.seller : conversation.buyer
  const iAmBuyer = conversation.buyer_id === me
  const listing = conversation.listing

  const markRead = useCallback(async () => {
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversation.id })
    onRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id])

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
        markRead()
      })
  }, [conversation.id, markRead])

  useEffect(
    () =>
      onMessage((msg) => {
        if (msg.conversation_id !== conversation.id) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          // Our own message echoing back — the insert response will reconcile it.
          if (msg.sender_id === me && prev.some((m) => m.pending && m.body === msg.body)) return prev
          return [...prev, msg]
        })
        if (msg.sender_id !== me) markRead()
      }),
    [onMessage, conversation.id, me, markRead],
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: loading ? 'auto' : 'smooth' })
  }, [messages.length, loading])

  const send = async (text?: string) => {
    const body = (text ?? draft).trim()
    if (!body) return
    const tempId = `temp-${crypto.randomUUID()}`
    const optimistic: LocalMessage = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: me,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    if (!text) setDraft('')
    inputRef.current?.focus()

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversation.id, sender_id: me, body })
      .select('*')
      .single()

    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== tempId)
      if (error || !data) return without
      return without.some((m) => m.id === data.id) ? without : [...without, data]
    })
    if (error) {
      toast.error(errorMessage(error, 'Message failed to send'))
      setDraft(body)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  // Auto-grow the composer.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  const lastMineId = [...messages].reverse().find((m) => m.sender_id === me)?.id

  const quickReplies = iAmBuyer
    ? [
        'Hi! Is this still available?',
        listing ? `Would you take ${formatPrice(Math.round(Number(listing.price) * 0.85))}?` : 'Would you take a lower offer?',
        'Could you ship it this week?',
      ]
    : ['Yes, it’s still available!', 'Happy to answer any questions.', 'I can ship it tomorrow.']

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <button onClick={onBack} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink md:hidden" aria-label="Back to inbox">
          <ArrowLeft className="size-5" />
        </button>
        <Link to={other ? `/u/${other.username}` : '#'} className="flex min-w-0 items-center gap-3">
          <Avatar src={other?.avatar_url} name={displayName(other)} seed={other?.id} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{displayName(other)}</p>
            <p className="truncate text-xs text-muted">{iAmBuyer ? 'Seller' : 'Interested buyer'}{other ? ` · @${other.username}` : ''}</p>
          </div>
        </Link>
        {listing && (
          <Link
            to={`/listing/${listing.id}`}
            className="ml-auto flex max-w-[50%] items-center gap-3 rounded-2xl border border-line bg-canvas/50 py-1.5 pr-3 pl-1.5 transition hover:border-line-strong"
          >
            <ListingImage path={listing.images[0]} alt="" category={listing.category} width={100} className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 max-sm:hidden">
              <p className="truncate text-[13px] font-medium">{listing.title}</p>
              <p className="text-[12px] text-muted">
                {formatPrice(listing.price)}
                {listing.status === 'sold' && ' · Sold'}
              </p>
            </div>
          </Link>
        )}
      </header>

      <div ref={scrollRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Avatar src={other?.avatar_url} name={displayName(other)} seed={other?.id} size={64} />
            <p className="mt-4 font-semibold">Start the conversation</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              {iAmBuyer ? `Say hi to ${displayName(other).split(' ')[0]} and ask anything about the item.` : 'Reply to your buyer.'}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-1">
            {messages.map((m, i) => {
              const mine = m.sender_id === me
              const prev = messages[i - 1]
              const next = messages[i + 1]
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
              const groupedWithPrev = prev && !newDay && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60_000
              const groupedWithNext =
                next &&
                next.sender_id === m.sender_id &&
                new Date(next.created_at).toDateString() === new Date(m.created_at).toDateString() &&
                +new Date(next.created_at) - +new Date(m.created_at) < 5 * 60_000
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted">{dayLabel(m.created_at)}</span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn('flex flex-col', mine ? 'items-end' : 'items-start', !groupedWithPrev && i > 0 && !newDay && 'mt-3')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap sm:max-w-[70%]',
                        mine ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink',
                        mine
                          ? cn('rounded-3xl', groupedWithPrev && 'rounded-tr-lg', groupedWithNext && 'rounded-br-lg')
                          : cn('rounded-3xl', groupedWithPrev && 'rounded-tl-lg', groupedWithNext && 'rounded-bl-lg'),
                        m.pending && 'opacity-60',
                      )}
                    >
                      {m.body}
                    </div>
                    {!groupedWithNext && (
                      <span className="mt-1 flex items-center gap-1 px-2 text-[11px] text-muted">
                        {m.pending ? 'Sending…' : shortTime(m.created_at)}
                        {mine && m.id === lastMineId && m.read_at && (
                          <>
                            <span>·</span>
                            <CheckCheck className="size-3 text-success" /> Seen
                          </>
                        )}
                      </span>
                    )}
                  </motion.div>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3 sm:p-4">
        <AnimatePresence>
          {!loading && messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="shrink-0 rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-medium text-ink-2 transition hover:border-ink hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-end gap-2 rounded-3xl border border-line-strong bg-canvas/60 p-1.5 pl-4 transition focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${displayName(other).split(' ')[0]}…`}
            maxLength={2000}
            className="max-h-36 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition hover:bg-accent-strong active:scale-95 disabled:bg-surface-3 disabled:text-muted"
            aria-label="Send message"
          >
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </>
  )
}
