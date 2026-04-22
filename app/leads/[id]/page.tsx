'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Globe, MapPin, Tag, Mail, Zap, FileText,
  AlertCircle, CheckCircle, ChevronDown, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge'
import { EmailEditor } from '@/components/emails/EmailEditor'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ALL_STATUSES, STATUS_LABELS, formatDate, cn } from '@/lib/utils'
import type { Lead, LeadStatus, EmailType, WebsiteAnalysis } from '@/lib/types'

const SEVERITY_COLORS = {
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low: 'text-text-3 bg-surface-2 border-border',
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Section states
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [generatingType, setGeneratingType] = useState<EmailType | null>(null)
  const [generateError, setGenerateError] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendError, setSendError] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [deletingLead, setDeletingLead] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/leads/${id}`)
        if (!res.ok) throw new Error('Lead not found')
        const data: Lead = await res.json()
        setLead(data)
        setNotes(data.notes || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lead')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setLead((l) => l ? { ...l, status } : l)
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const res = await fetch(`/api/leads/${id}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setLead((l) => l ? { ...l, analysis: data.analysis, status: 'ANALYZED' } : l)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerateEmail(type: EmailType) {
    setGeneratingType(type)
    setGenerateError('')
    try {
      const res = await fetch(`/api/leads/${id}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setLead((l) => l ? { ...l, emails: [...l.emails.filter((e) => e.type !== type), data] } : l)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate email')
    } finally {
      setGeneratingType(null)
    }
  }

  async function handleSaveEmail(emailId: string, subject: string, body: string) {
    const res = await fetch(`/api/leads/${id}/generate-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, subject, body }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead((l) => l ? { ...l, emails: l.emails.map((e) => e.id === emailId ? updated : e) } : l)
    }
  }

  async function handleSendEmail(emailId: string) {
    setSendingId(emailId)
    setSendError('')
    try {
      const res = await fetch(`/api/leads/${id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setLead((l) => {
        if (!l) return l
        const email = l.emails.find((e) => e.id === emailId)
        const newStatus: LeadStatus =
          email?.type === 'INITIAL' ? 'EMAIL_SENT' :
          email?.type === 'FOLLOW_UP_3' ? 'FOLLOWED_UP' :
          'FOLLOWED_UP'
        return {
          ...l,
          status: newStatus,
          emails: l.emails.map((e) => e.id === emailId ? { ...e, sentAt: new Date().toISOString() } : e),
        }
      })
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingId(null)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    }
    setSavingNotes(false)
  }

  async function handleDelete() {
    setDeletingLead(false)
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/leads')
  }

  if (loading) return <PageLoader text="Loading lead…" />

  if (error || !lead) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || 'Lead not found'}</p>
        <Link href="/leads" className="text-accent text-sm mt-2 inline-block">← Back to Leads</Link>
      </div>
    )
  }

  const analysis = lead.analysis as WebsiteAnalysis | null
  const initialEmail = lead.emails.find((e) => e.type === 'INITIAL')
  const followUp3 = lead.emails.find((e) => e.type === 'FOLLOW_UP_3')
  const followUp7 = lead.emails.find((e) => e.type === 'FOLLOW_UP_7')
  const hasInitialSent = !!initialEmail?.sentAt
  const hasFollowUp3Sent = !!followUp3?.sentAt

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Link href="/leads">
            <button className="p-2 rounded-lg hover:bg-surface-2 text-text-2 hover:text-text-1 transition-colors mt-0.5">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-1 tracking-tight">{lead.businessName}</h1>
            <p className="text-sm text-text-3 mt-0.5">Added {formatDate(lead.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            className="w-36"
          />
          <button
            onClick={() => setDeletingLead(true)}
            className="p-2 rounded-lg hover:bg-red-400/10 text-text-3 hover:text-red-400 transition-colors"
            title="Delete lead"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Lead Info */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-1 mb-4">Lead Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {lead.websiteUrl && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-text-3 shrink-0" />
                <a
                  href={lead.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline truncate"
                >
                  {lead.websiteUrl}
                </a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-text-3 shrink-0" />
                <span className="text-sm text-text-2">{lead.email}</span>
              </div>
            )}
            {lead.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-text-3 shrink-0" />
                <span className="text-sm text-text-2">{lead.city}</span>
              </div>
            )}
            {lead.niche && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-text-3 shrink-0" />
                <span className="text-sm text-text-2">{lead.niche}</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-1">Website Analysis</h2>
            </div>
            {lead.websiteUrl && (
              <Button
                variant={analysis ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleAnalyze}
                loading={analyzing}
              >
                <Zap className="w-3.5 h-3.5" />
                {analysis ? 'Re-analyze' : 'Analyze Website'}
              </Button>
            )}
          </div>

          {!lead.websiteUrl && (
            <p className="text-sm text-text-3">No website URL provided for this lead.</p>
          )}

          {analysisError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{analysisError}</span>
            </div>
          )}

          {analyzing && (
            <div className="text-sm text-text-2 animate-pulse">
              Fetching and analyzing website… this may take 15-30 seconds.
            </div>
          )}

          {analysis && !analyzing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      analysis.score >= 70 ? 'bg-emerald-500' :
                      analysis.score >= 40 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-text-1 w-12 text-right">
                  {analysis.score}/100
                </span>
              </div>
              <p className="text-sm text-text-2 leading-relaxed">{analysis.summary}</p>
              <div className="space-y-2">
                {analysis.painPoints.map((point, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm',
                      SEVERITY_COLORS[point.severity],
                    )}
                  >
                    <span className="font-medium shrink-0">{point.category}</span>
                    <span className="opacity-80">{point.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Email Generation */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-text-2" />
              <h2 className="text-sm font-semibold text-text-1">Cold Email</h2>
            </div>
            {!initialEmail && analysis && (
              <Button
                size="sm"
                onClick={() => handleGenerateEmail('INITIAL')}
                loading={generatingType === 'INITIAL'}
              >
                <Zap className="w-3.5 h-3.5" />
                Generate Email
              </Button>
            )}
          </div>

          {!analysis && !initialEmail && (
            <p className="text-sm text-text-3">
              Analyze the website first to generate a personalized email.
            </p>
          )}

          {generateError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{generateError}</span>
            </div>
          )}

          {sendError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{sendError}</span>
            </div>
          )}

          <div className="space-y-4">
            {initialEmail && (
              <EmailEditor
                leadId={id}
                leadEmail={lead.email}
                emailRecord={initialEmail}
                type="INITIAL"
                onRegenerate={handleGenerateEmail}
                onSave={handleSaveEmail}
                onSend={handleSendEmail}
                generatingType={generatingType}
                sendingId={sendingId}
              />
            )}

            {/* Follow-up section — only show after initial email is sent */}
            {hasInitialSent && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-3 px-2">Follow-ups</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {followUp3 ? (
                  <EmailEditor
                    leadId={id}
                    leadEmail={lead.email}
                    emailRecord={followUp3}
                    type="FOLLOW_UP_3"
                    onRegenerate={handleGenerateEmail}
                    onSave={handleSaveEmail}
                    onSend={handleSendEmail}
                    generatingType={generatingType}
                    sendingId={sendingId}
                  />
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGenerateEmail('FOLLOW_UP_3')}
                    loading={generatingType === 'FOLLOW_UP_3'}
                  >
                    Generate Day 3 Follow-up
                  </Button>
                )}

                {(hasFollowUp3Sent || followUp3?.sentAt) && (
                  followUp7 ? (
                    <EmailEditor
                      leadId={id}
                      leadEmail={lead.email}
                      emailRecord={followUp7}
                      type="FOLLOW_UP_7"
                      onRegenerate={handleGenerateEmail}
                      onSave={handleSaveEmail}
                      onSend={handleSendEmail}
                      generatingType={generatingType}
                      sendingId={sendingId}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateEmail('FOLLOW_UP_7')}
                      loading={generatingType === 'FOLLOW_UP_7'}
                    >
                      Generate Day 7 Follow-up
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-text-2" />
            <h2 className="text-sm font-semibold text-text-1">Notes</h2>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this lead…"
            rows={4}
          />
          <div className="flex items-center justify-between mt-3">
            {notesSaved && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <div className="ml-auto">
              <Button size="sm" variant="secondary" onClick={handleSaveNotes} loading={savingNotes}>
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeletingLead(false)} />
          <div className="relative bg-surface border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <h3 className="text-base font-semibold text-text-1 mb-2">Delete Lead?</h3>
            <p className="text-sm text-text-2 mb-5">
              This will permanently delete <strong>{lead.businessName}</strong> and all associated emails.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setDeletingLead(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
