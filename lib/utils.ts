import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { LeadStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  ANALYZED: 'Analyzed',
  EMAIL_SENT: 'Email Sent',
  FOLLOWED_UP: 'Followed Up',
  REPLIED: 'Replied',
  CONVERTED: 'Converted',
  ARCHIVED: 'Archived',
}

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'text-text-2 bg-surface-3 border-border-2',
  ANALYZED: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  EMAIL_SENT: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  FOLLOWED_UP: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  REPLIED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  CONVERTED: 'text-green-400 bg-green-400/10 border-green-400/20',
  ARCHIVED: 'text-text-3 bg-surface-2 border-border',
}

export const ALL_STATUSES: LeadStatus[] = [
  'NEW', 'ANALYZED', 'EMAIL_SENT', 'FOLLOWED_UP', 'REPLIED', 'CONVERTED', 'ARCHIVED',
]

export const ACTIVE_STATUSES: LeadStatus[] = [
  'NEW', 'ANALYZED', 'EMAIL_SENT', 'FOLLOWED_UP', 'REPLIED', 'CONVERTED',
]

export const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o — Best quality' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini — Faster & cheaper' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo — Legacy' },
]

export const DEFAULT_OPENAI_MODEL = 'gpt-4o'

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}…` : str
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Strip HTML tags to extract plain text for AI analysis */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
