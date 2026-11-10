import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Condition } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const currencyRound = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** $1,234 for whole amounts, $12.50 otherwise. */
export function formatPrice(value: number | string | null | undefined) {
  const n = Number(value ?? 0)
  return Number.isInteger(n) ? currencyRound.format(n) : currency.format(n)
}

export function formatMoney(value: number | string | null | undefined) {
  return currency.format(Number(value ?? 0))
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), 'day')
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / (86400 * 7)), 'week')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function shortTime(date: string) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const diffDays = (now.getTime() - d.getTime()) / 86400000
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }) {
  return new Date(date).toLocaleDateString('en-US', opts)
}

export const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Unused, with tags or in original packaging' },
  { value: 'like_new', label: 'Like new', hint: 'Used once or twice, no signs of wear' },
  { value: 'good', label: 'Good', hint: 'Gently used, minor signs of wear' },
  { value: 'fair', label: 'Fair', hint: 'Well loved, visible wear but works fine' },
]

export function conditionLabel(c: string) {
  return CONDITIONS.find((x) => x.value === c)?.label ?? c
}

export function displayName(p: { full_name?: string | null; username?: string | null } | null | undefined) {
  if (!p) return 'Deleted user'
  return p.full_name?.trim() || p.username || 'Trove user'
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Pull a readable message out of anything thrown by supabase-js or the browser. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message
  }
  return fallback
}

/** Strip characters that would break a PostgREST `or=(...)` filter. */
export function sanitizeSearch(q: string) {
  return q.replace(/[,()*%\\:"'.]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const SHIPPING_PER_SELLER = 4.99

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n.toLocaleString()} ${n === 1 ? word : plural}`
}
