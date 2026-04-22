'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Globe, MapPin, Tag, Mail, Zap, FileText,
  AlertCircle, CheckCircle, ChevronDown, Trash2,
  MessageCircle, Monitor, Search, ShieldCheck, ShieldX,
  Smartphone, WifiOff, CheckCircle2, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge'
import { EmailEditor } from '@/components/emails/EmailEditor'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ALL_STATUSES, STATUS_LABELS, formatDate, cn } from '@/lib/utils'
import type {
  Lead, LeadStatus, EmailType, WebsiteAnalysis, RichAnalysis, AnalysisType,
} from '@/lib/types'

const SEVERITY_COLORS = {
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low: 'text-text-3 bg-surface-2 border-border',
}

const SCORE_COLOR = (s: number) =>
  s >= 70 ? 'bg-emerald-500' : s >= 40 ? 'bg-amber-500' : 'bg-red-500'

const ANALYSIS_OPTIONS: { type: AnalysisType; label: string; icon: React.ElementType }[] = [
  { type: 'chatbot', label: 'Chatbot', icon: MessageCircle },
  { type: 'website', label: 'Website Issues', icon: Monitor },
  { type: 'seo', label: 'SEO', icon: Search },
]

function isRichAnalysis(a: WebsiteAnalysis | RichAnalysis): a is RichAnalysis {
  return 'types' in a
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [analyzeTypes, setAnalyzeTypes] = useState<Set<AnalysisType>>(
    new Set(['chatbot', 'website', 'seo']),
  )
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
      const res = await fetch(`/api/leads/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: [...analyzeTypes] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setLead((l) => l ? { ...l, analysis: data.analysis, status: 'ANALYZED' } : l)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleAnalyzeType(type: AnalysisType) {
    setAnalyzeTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size === 1) return prev
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
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
        const newStatus: LeadStatus = email?.type === 'INITIAL' ? 'EMAIL_SENT' : 'FOLLOWED_UP'
        return {
          ...l,
          status: newStatus,
          emails: l.emails.map((e) =>
            e.id === emailId ? { ...e, sentAt: new Date().toISOString() } : e,
          ),
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

  const analysis = lead.analysis as WebsiteAnalysis | RichAnalysis | null
  const rich = analysis && isRichAnalysis(analysis) ? analysis : null
  const legacy = analysis && !isRichAnalysis(analysis) ? analysis : null

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
          </div>

          {!lead.websiteUrl && (
            <p className="text-sm text-text-3">No website URL provided for this lead.</p>
          )}

          {lead.websiteUrl && (
            <>
              {/* Analysis type picker */}
              <div className="flex items-center gap-2 mb-4">
                {ANALYSIS_OPTIONS.map(({ type, label, icon: Icon }) => {
                  const active = analyzeTypes.has(type)
                  return (
                    <button
                      key={type}
                      onClick={() => toggleAnalyzeType(type)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors',
                        active
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-border bg-surface-2 text-text-3 hover:text-text-2',
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  )
                })}
                <div className="flex-1" />
                <Button
                  variant={analysis ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleAnalyze}
                  loading={analyzing}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {analysis ? 'Re-analyse' : 'Analyse Website'}
                </Button>
              </div>

              {analysisError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{analysisError}</span>
                </div>
              )}

              {analyzing && (
                <div className="text-sm text-text-2 animate-pulse">
                  Fetching and analysing website… this may take 20-45 seconds depending on selected options.
                </div>
              )}

              {/* Rich analysis display */}
              {rich && !analyzing && (
                <div className="space-y-5">
                  {/* Overall score + summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', SCORE_COLOR(rich.score))}
                          style={{ width: `${rich.score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-text-1 w-12 text-right">
                        {rich.score}/100
                      </span>
                    </div>
                    <p className="text-sm text-text-2 leading-relaxed">{rich.summary}</p>
                  </div>

                  {/* Chatbot section */}
                  {rich.chatbot && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-border">
                        <MessageCircle className="w-3.5 h-3.5 text-text-3" />
                        <span className="text-xs font-semibold text-text-1 uppercase tracking-wide">Chatbot</span>
                      </div>
                      <div className="px-3 py-3 flex items-center gap-3">
                        {rich.chatbot.hasChatbot ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-sm text-text-1">
                              Live chat detected —{' '}
                              <span className="font-medium text-emerald-400">{rich.chatbot.platform}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-sm text-text-2">
                              No chatbot or live chat widget found. Visitors have no instant contact option.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Website Issues section */}
                  {rich.website && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5 text-text-3" />
                          <span className="text-xs font-semibold text-text-1 uppercase tracking-wide">Website Issues</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn('flex items-center gap-1 text-xs', rich.website.hasSSL ? 'text-emerald-400' : 'text-red-400')}>
                            {rich.website.hasSSL ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                            {rich.website.hasSSL ? 'HTTPS' : 'No HTTPS'}
                          </span>
                          <span className={cn('flex items-center gap-1 text-xs', rich.website.mobileReady ? 'text-emerald-400' : 'text-amber-400')}>
                            <Smartphone className="w-3 h-3" />
                            {rich.website.mobileReady ? 'Mobile ready' : 'Not mobile-ready'}
                          </span>
                          <span className="text-xs text-text-3">{rich.website.score}/100</span>
                        </div>
                      </div>
                      <div className="divide-y divide-border">
                        {rich.website.issues.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-text-3">No significant issues detected.</p>
                        ) : (
                          rich.website.issues.map((issue, i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex items-start gap-3 px-3 py-2.5 text-sm',
                                SEVERITY_COLORS[issue.severity as keyof typeof SEVERITY_COLORS],
                              )}
                            >
                              <span className="font-medium shrink-0 text-xs mt-0.5 uppercase tracking-wide">
                                {issue.category}
                              </span>
                              <span className="opacity-80 text-xs leading-relaxed">{issue.description}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEO section */}
                  {rich.seo && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-text-3" />
                          <span className="text-xs font-semibold text-text-1 uppercase tracking-wide">SEO Analysis</span>
                        </div>
                        <span className="text-xs text-text-3">{rich.seo.score}/100</span>
                      </div>

                      {/* Quick signals grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-border border-b border-border">
                        {[
                          { label: 'Title', ok: rich.seo.hasTitle, detail: rich.seo.titleLength ? `${rich.seo.titleLength} chars` : 'missing' },
                          { label: 'Meta Desc', ok: rich.seo.hasMetaDescription, detail: rich.seo.metaDescriptionLength ? `${rich.seo.metaDescriptionLength} chars` : 'missing' },
                          { label: 'Schema', ok: rich.seo.hasSchemaMarkup, detail: rich.seo.schemaTypes.length > 0 ? rich.seo.schemaTypes.slice(0, 2).join(', ') : 'none' },
                          { label: 'Canonical', ok: rich.seo.hasCanonical, detail: rich.seo.hasCanonical ? 'present' : 'missing' },
                        ].map(({ label, ok, detail }) => (
                          <div key={label} className="px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {ok
                                ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                : <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                              <span className="text-xs font-medium text-text-1">{label}</span>
                            </div>
                            <span className="text-xs text-text-3">{detail}</span>
                          </div>
                        ))}
                      </div>

                      {/* Structural counts */}
                      <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs text-text-2">
                        <span>H1: <strong className={cn(rich.seo.h1Count === 1 ? 'text-emerald-400' : 'text-amber-400')}>{rich.seo.h1Count}</strong></span>
                        <span>H2: <strong className="text-text-1">{rich.seo.h2Count}</strong></span>
                        <span>~{rich.seo.estimatedWordCount.toLocaleString()} words</span>
                        {rich.seo.imagesWithoutAlt > 0 && (
                          <span className="text-amber-400">{rich.seo.imagesWithoutAlt} images missing alt</span>
                        )}
                      </div>

                      {/* Issues & strengths */}
                      <div className="divide-y divide-border">
                        {rich.seo.issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2.5">
                            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-text-2 leading-relaxed">{issue}</span>
                          </div>
                        ))}
                        {rich.seo.strengths.map((strength, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-text-2 leading-relaxed">{strength}</span>
                          </div>
                        ))}
                        {rich.seo.issues.length === 0 && rich.seo.strengths.length === 0 && (
                          <p className="px-3 py-2 text-xs text-text-3">No specific SEO signals identified.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Legacy analysis display */}
              {legacy && !analyzing && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', SCORE_COLOR(legacy.score))}
                        style={{ width: `${legacy.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-text-1 w-12 text-right">
                      {legacy.score}/100
                    </span>
                  </div>
                  <p className="text-sm text-text-2 leading-relaxed">{legacy.summary}</p>
                  <div className="space-y-2">
                    {legacy.painPoints.map((point, i) => (
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
            </>
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
              Analyse the website first to generate a personalised email.
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
