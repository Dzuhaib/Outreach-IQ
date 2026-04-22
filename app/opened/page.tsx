'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MailOpen, Eye, ArrowUpRight, RefreshCw } from 'lucide-react'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { formatDateTime, formatDate } from '@/lib/utils'
import type { OpenedEmailItem, EmailType } from '@/lib/types'

const TYPE_LABELS: Record<EmailType, string> = {
  INITIAL: 'Initial',
  FOLLOW_UP_3: 'Day 3 Follow-up',
  FOLLOW_UP_7: 'Day 7 Follow-up',
}

const TYPE_COLORS: Record<EmailType, string> = {
  INITIAL: 'text-accent bg-accent/10 border-accent/20',
  FOLLOW_UP_3: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  FOLLOW_UP_7: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

export default function OpenedEmailsPage() {
  const [emails, setEmails] = useState<OpenedEmailItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/emails/opened')
      if (res.ok) {
        const data = await res.json()
        setEmails(data.emails)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageLoader text="Loading opened emails…" />

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-1 tracking-tight">Opened Emails</h1>
          <p className="text-sm text-text-2 mt-1">
            {emails.length > 0
              ? `${emails.length} email${emails.length !== 1 ? 's' : ''} opened by prospects`
              : 'Track when prospects open your emails'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} loading={refreshing}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-4">
            <MailOpen className="w-5 h-5 text-text-3" />
          </div>
          <p className="text-sm font-medium text-text-1 mb-1">No opens yet</p>
          <p className="text-sm text-text-3 max-w-xs">
            Once a prospect opens one of your emails, it will appear here.
            Open tracking requires HTML emails — make sure Gmail is connected.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div
              key={email.id}
              className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left — lead + email info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Link
                      href={`/leads/${email.lead.id}`}
                      className="text-sm font-semibold text-text-1 hover:text-accent transition-colors flex items-center gap-1"
                    >
                      {email.lead.businessName}
                      <ArrowUpRight className="w-3 h-3 opacity-50" />
                    </Link>
                    {email.lead.email && (
                      <span className="text-xs text-text-3">{email.lead.email}</span>
                    )}
                    {/* Email type badge */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[email.type as EmailType]}`}>
                      {TYPE_LABELS[email.type as EmailType]}
                    </span>
                    {/* Open count badge */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20">
                      <Eye className="w-3 h-3" />
                      {email.openCount === 1 ? 'Opened once' : `Opened ${email.openCount}×`}
                    </span>
                  </div>

                  {/* Subject */}
                  <p className="text-sm text-text-2 truncate mb-1">{email.subject}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-text-3 flex-wrap">
                    {email.lead.niche && <span>{email.lead.niche}</span>}
                    {email.lead.city && <span>{email.lead.city}</span>}
                    {email.sentAt && <span>Sent {formatDate(email.sentAt)}</span>}
                  </div>
                </div>

                {/* Right — opened timestamp */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-text-3 mb-0.5">First opened</p>
                  <p className="text-xs font-medium text-blue-400">{formatDateTime(email.openedAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
