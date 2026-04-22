'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Upload, Search, SlidersHorizontal, X } from 'lucide-react'
import { LeadTable } from '@/components/leads/LeadTable'
import { AddLeadModal } from '@/components/leads/AddLeadModal'
import { CSVImport } from '@/components/leads/CSVImport'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ALL_STATUSES, STATUS_LABELS } from '@/lib/utils'
import type { LeadListItem, LeadStatus, Lead } from '@/lib/types'

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [nicheFilter, setNicheFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

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

  async function handleDelete(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) setLeads((prev) => prev.filter((l) => l.id !== id))
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
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l))
    }
  }

  async function handleStatusChange(id: string, status: LeadStatus) {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l))
    }
  }

  function handleCreated(lead: Lead) {
    const listItem: LeadListItem = {
      id: lead.id,
      businessName: lead.businessName,
      websiteUrl: lead.websiteUrl,
      city: lead.city,
      niche: lead.niche,
      email: lead.email,
      status: lead.status,
      archivedAt: lead.archivedAt,
      createdAt: lead.createdAt,
      _count: { emails: 0 },
    }
    setLeads((prev) => [listItem, ...prev])
  }

  const hasFilters = !!(statusFilter || cityFilter || nicheFilter)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-1 tracking-tight">Leads</h1>
          <p className="text-sm text-text-2 mt-1">
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" />
            Import CSV
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
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1"
            >
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter(''); setCityFilter(''); setNicheFilter('') }}
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Error */}
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
            onDelete={handleDelete}
            onArchive={handleArchive}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      <CSVImport open={showImport} onClose={() => setShowImport(false)} onImported={() => fetchLeads()} />
    </div>
  )
}
