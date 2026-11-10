import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { Message } from '../lib/types'
import { useAuth } from './AuthContext'

type Listener = (message: Message) => void

type InboxState = {
  unread: number
  refreshUnread: () => Promise<void>
  /** Subscribe to every new message in the user's conversations. Returns an unsubscribe fn. */
  onMessage: (fn: Listener) => () => void
}

const InboxContext = createContext<InboxState | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [unread, setUnread] = useState(0)
  const listeners = useRef(new Set<Listener>())
  const location = useLocation()
  const navigate = useNavigate()
  const pathRef = useRef(location.pathname)
  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnread(0)
      return
    }
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .neq('sender_id', userId)
    setUnread(count ?? 0)
  }, [userId])

  useEffect(() => {
    refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        listeners.current.forEach((fn) => fn(msg))
        if (msg.sender_id !== userId) {
          refreshUnread()
          if (pathRef.current !== `/messages/${msg.conversation_id}`) {
            toast('New message', {
              description: msg.body.length > 90 ? msg.body.slice(0, 90) + '…' : msg.body,
              action: { label: 'Open', onClick: () => navigate(`/messages/${msg.conversation_id}`) },
            })
          }
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refreshUnread, navigate])

  const onMessage = useCallback((fn: Listener) => {
    listeners.current.add(fn)
    return () => {
      listeners.current.delete(fn)
    }
  }, [])

  const value = useMemo(() => ({ unread, refreshUnread, onMessage }), [unread, refreshUnread, onMessage])
  return <InboxContext value={value}>{children}</InboxContext>
}

export function useInbox() {
  const ctx = use(InboxContext)
  if (!ctx) throw new Error('useInbox must be used inside InboxProvider')
  return ctx
}
