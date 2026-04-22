'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Upload, Search, SlidersHorizontal, X,
  Zap, Send, CheckSquare,
} from 'lucide-react'
import { LeadTable } from '@/components/leads/LeadTable'
import { AddLeadModal } from '@/components/leads/AddLeadModal'
import { CSVImport } from '@/components/leads/CSVImport'
import { BulkProgressModal, type BulkProgress } from '@/components/leads/BulkProgressModal'
import { BulkAnalyzeOptionsModal } from '@/components/leads/BulkAnalyzeOptionsModal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ALL_STATUSES, STATUS_LABELS, sleep } from '@/lib/utils'
import type { LeadListItem, LeadStatus, Lead, AnalysisType } from '@/lib/types'

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [nicheFilter, setNicheFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Bulk progress
  const [progress, setProgress] = useState<BulkProgress | null>(null)

  // Pending bulk analyze — ids waiting for options modal confirmation
  const [pendingAnalyzeIds, setPendingAnalyzeIds] = useState<Set<string> | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (cityFilter) params.set('city', cityFilter)
      if (nicheFilter) params.set('niche', nicheFilter)
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Failed to load leads')
      const data = await res.json()
      setLeads(data.leads)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, cityFilter, nicheFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // ── Single-lead actions ─────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    setLeads((prev) => prev.filter((l) => l.id !== id))
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  async function handleArchive(id: string) {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return
    const newStatus = lead.status === 'ARCHIVED' ? 'NEW' : 'ARCHIVED'
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l))
  }

  async function handleStatusChange(id: string, status: LeadStatus) {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l))
  }

  function handleCreated(lead: Lead) {
    const item: LeadListItem = {
      id: lead.id, businessName: lead.businessName, websiteUrl: lead.websiteUrl,
      city: lead.city, niche: lead.niche, email: lead.email, status: lead.status,
      archivedAt: lead.archivedAt, createdAt: lead.createdAt, _count: { emails: 0 },
    }
    setLeads((prev) => [item, ...prev])
  }

  // ── Bulk: Analyze (shows options modal first) ───────────────────────────────

  function handleBulkAnalyze(ids: Set<string>) {
    const targets = leads.filter((l) => ids.has(l.id) && l.websiteUrl && l.status !== 'ARCHIVED')
    if (targets.length === 0) {
      alert('None of the selected leads have a website URL to analyze.')
      return
    }
    setPendingAnalyzeIds(new Set(targets.map((l) => l.id)))
  }

  async function startBulkAnalyze(ids: Set<string>, types: AnalysisType[]) {
    const targets = leads.filter((l) => ids.has(l.id))
    setProgress({ type: 'analyze', current: 0, total: targets.length, currentName: '', done: false, results: [] })

    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i]
      setProgress((p) => p ? { ...p, currentName: lead.businessName } : p)

      let ok = false
      let errorMsg = ''
      try {
        const res = await fetch(`/api/leads/${lead.id}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ types }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Analysis failed')
        ok = true
        setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: 'ANALYZED' } : l))
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : 'Failed'
      }

      setProgress((p) => p ? {
        ...p,
        current: i + 1,
        results: [...p.results, { name: lead.businessName, ok, error: errorMsg || undefined }],
      } : p)

      if (i < targets.length - 1) await sleep(1000)
    }

    setProgress((p) => p ? { ...p, done: true, currentName: '' } : p)
  }

  // ── Bulk: Generate & Send ───────────────────────────────────────────────────

  async function handleBulkSend(ids: Set<string>) {
    const targets = leads.filter(
      (l) => ids.has(l.id) && l.email && l.status !== 'ARCHIVED',
    )
    if (targets.length === 0) {
      alert('None of the selected leads have an email address. Add contact emails first.')
      return
    }

    const notAnalyzed = targets.filter((l) => l.status === 'NEW')
    if (notAnalyzed.length > 0) {
      const confirmed = window.confirm(
        `${notAnalyzed.length} lead(s) haven't been analyzed yet. ` +
        `They'll be analyzed first, then emailed. Continue?`
      )
      if (!confirmed) return
    }

    setProgress({ type: 'send', current: 0, total: targets.length, currentName: '', done: false, results: [] })

    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i]
      setProgress((p) => p ? { ...p, currentName: lead.businessName } : p)

      let ok = false
      let errorMsg = ''

      try {
        // Step 1: Analyze if not yet done (full analysis for email generation)
        if (lead.status === 'NEW' && lead.websiteUrl) {
          const aRes = await fetch(`/api/leads/${lead.id}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ types: ['chatbot', 'website', 'seo'] }),
          })
          if (!aRes.ok) {
            const d = await aRes.json()
            throw new Error(d.error || 'Analysis failed')
          }
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: 'ANALYZED' } : l))
          await sleep(500)
        }

        // Step 2: Generate email
        const gRes = await fetch(`/api/leads/${lead.id}/generate-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'INITIAL' }),
        })
        const gData = await gRes.json()
        if (!gRes.ok) throw new Error(gData.error || 'Generation failed')

        // Step 3: Send email
        const sRes = await fetch(`/api/leads/${lead.id}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId: gData.id }),
        })
        const sData = await sRes.json()
        if (!sRes.ok) throw new Error(sData.error || 'Send failed')

        ok = true
        setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: 'EMAIL_SENT' } : l))
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : 'Failed'
      }

      setProgress((p) => p ? {
        ...p,
        current: i + 1,
        results: [...p.results, { name: lead.businessName, ok, error: errorMsg || undefined }],
      } : p)

      // 3s delay between sends to avoid being flagged as spam
      if (i < targets.length - 1) await sleep(3000)
    }

    setProgress((p) => p ? { ...p, done: true, currentName: '' } : p)
  }

  // ── Bulk: Analyze All New ───────────────────────────────────────────────────

  function handleAnalyzeAllNew() {
    const newWithUrl = new Set(
      leads.filter((l) => l.status === 'NEW' && l.websiteUrl).map((l) => l.id)
    )
    if (newWithUrl.size === 0) {
      alert('No new leads with a website URL found.')
      return
    }
    // Go through options modal
    setPendingAnalyzeIds(newWithUrl)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hasFilters = !!(statusFilter || cityFilter || nicheFilter)
  const newLeadsWithUrl = leads.filter((l) => l.status === 'NEW' && l.websiteUrl).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-1 tracking-tight">Leads</h1>
          <p className="text-sm text-text-2 mt-1">
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
            {newLeadsWithUrl > 0 && (
              <span className="ml-2 text-text-3">· {newLeadsWithUrl} new with website</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {newLeadsWithUrl > 0 && (
            <Button variant="secondary" onClick={handleAnalyzeAllNew}>
              <Zap className="w-4 h-4" />
              Analyze All New ({newLeadsWithUrl})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm text-text-1 placeholder-text-3 focus:outline-none focus:border-accent/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters || hasFilters ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasFilters && (
            <span className="w-4 h-4 bg-accent text-white rounded-full text-xs flex items-center justify-center">
              {[statusFilter, cityFilter, nicheFilter].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="flex items-end gap-3 mb-4 p-4 bg-surface border border-border rounded-lg animate-fade-in">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            className="w-44"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-2 uppercase tracking-wide">City</label>
            <input
              type="text"
              placeholder="Filter by city"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-1 placeholder-text-3 focus:outline-none focus:border-accent/60 w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-2 uppercase tracking-wide">Niche</label>
            <input
              type="text"
              placeholder="Filter by niche"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-1 placeholder-text-3 focus:outline-none focus:border-accent/60 w-40"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setCityFilter(''); setNicheFilter('') }}>
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Bulk action bar — appears when leads are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg animate-fade-in">
          <CheckSquare className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-medium text-text-1">
            {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkAnalyze(selectedIds)}
            >
              <Zap className="w-3.5 h-3.5" />
              Analyze Selected
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkSend(selectedIds)}
            >
              <Send className="w-3.5 h-3.5" />
              Generate & Send
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded hover:bg-surface-2 text-text-3 hover:text-text-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <PageLoader text="Loading leads…" />
        ) : (
          <LeadTable
            leads={leads}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      <CSVImport open={showImport} onClose={() => setShowImport(false)} onImported={() => fetchLeads()} />

      {pendingAnalyzeIds && (
        <BulkAnalyzeOptionsModal
          leadCount={pendingAnalyzeIds.size}
          onStart={(types) => {
            const ids = pendingAnalyzeIds
            setPendingAnalyzeIds(null)
            startBulkAnalyze(ids, types)
          }}
          onClose={() => setPendingAnalyzeIds(null)}
        />
      )}

      {progress && (
        <BulkProgressModal
          progress={progress}
          onClose={() => {
            setProgress(null)
            setSelectedIds(new Set())
          }}
        />
      )}
    </div>
  )
}
