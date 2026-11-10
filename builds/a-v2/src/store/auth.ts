import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  username: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

interface AuthStore {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  signUp: async (email: string, password: string, username: string, fullName: string) => {
    try {
      set({ error: null })

      // Security: Validate input
      if (!email || !password || !username || password.length < 8) {
        throw new Error('Invalid input')
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error
      if (!data.user) throw new Error('Failed to create user')

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email,
          username,
          full_name: fullName,
        })

      if (profileError) throw profileError

      set({ user: data.user })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      set({ error: message })
      throw error
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ error: null })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (!data.user) throw new Error('Failed to sign in')

      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) throw profileError

      set({ user: data.user, profile })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      set({ error: message })
      throw error
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ user: null, profile: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      set({ error: message })
      throw error
    }
  },

  loadSession: async () => {
    try {
      set({ loading: true })

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Load profile
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (error) throw error
        set({ user: session.user, profile })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load session'
      set({ error: message })
    } finally {
      set({ loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
