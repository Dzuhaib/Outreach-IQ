'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink, Trash2, Archive, MoreHorizontal, ChevronUp, ChevronDown, Eye,
} from 'lucide-react'
import { LeadStatusBadge } from './LeadStatusBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { LeadListItem, LeadStatus } from '@/lib/types'

interface LeadTableProps {
  leads: LeadListItem[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onStatusChange: (id: string, status: LeadStatus) => void
}

type SortKey = 'businessName' | 'status' | 'createdAt' | 'city' | 'niche'
type SortDir = 'asc' | 'desc'

export function LeadTable({
  leads,
  selectedIds,
  onSelectionChange,
  onDelete,
  onArchive,
  onStatusChange,
}: LeadTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...leads].sort((a, b) => {
    let av = '', bv = ''
    if (sortKey === 'businessName') { av = a.businessName; bv = b.businessName }
    else if (sortKey === 'status') { av = a.status; bv = b.status }
    else if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt }
    else if (sortKey === 'city') { av = a.city || ''; bv = b.city || '' }
    else if (sortKey === 'niche') { av = a.niche || ''; bv = b.niche || '' }
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const allSelected = sorted.length > 0 && sorted.every((l) => selectedIds.has(l.id))
  const someSelected = sorted.some((l) => selectedIds.has(l.id))

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(sorted.map((l) => l.id)))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads yet"
        description="Add your first lead manually or import a CSV to get started."
      />
    )
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-text-3 opacity-0 group-hover:opacity-100" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-text-2" />
      : <ChevronDown className="w-3 h-3 text-text-2" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {/* Select-all checkbox */}
            <th className="pl-4 pr-2 py-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded accent-accent cursor-pointer"
              />
            </th>
            {([
              ['businessName', 'Business'],
              ['city', 'City'],
              ['niche', 'Niche'],
              ['status', 'Status'],
              ['createdAt', 'Added'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <th
                key={key}
                className="text-left px-4 py-3 text-xs font-medium text-text-3 uppercase tracking-wide cursor-pointer group"
                onClick={() => handleSort(key)}
              >
                <span className="flex items-center gap-1">
                  {label} <SortIcon col={key} />
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-xs font-medium text-text-3 uppercase tracking-wide text-right">
              Emails
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const isSelected = selectedIds.has(lead.id)
            return (
              <tr
                key={lead.id}
                className={`border-b border-border transition-colors group ${
                  isSelected ? 'bg-accent/5' : 'hover:bg-surface-2/50'
                }`}
              >
                <td className="pl-4 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(lead.id)}
                    className="w-3.5 h-3.5 rounded accent-accent cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-text-1 hover:text-accent transition-colors"
                  >
                    {lead.businessName}
                  </Link>
                  {lead.websiteUrl && (
                    <a
                      href={lead.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-text-3 hover:text-accent mt-0.5 w-fit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {truncate(lead.websiteUrl.replace(/^https?:\/\//, ''), 30)}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-text-2">{lead.city || '—'}</td>
                <td className="px-4 py-3 text-text-2">{lead.niche || '—'}</td>
                <td className="px-4 py-3">
                  <LeadStatusBadge status={lead.status as LeadStatus} />
                </td>
                <td className="px-4 py-3 text-text-3 text-xs">{formatDate(lead.createdAt)}</td>
                <td className="px-4 py-3 text-center text-text-3 text-xs">
                  <div className="flex items-center justify-center gap-1.5">
                    {lead._count.emails > 0
                      ? <span className="text-text-2">{lead._count.emails}</span>
                      : <span>—</span>}
                    {lead.openedEmailCount > 0 && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20">
                        <Eye className="w-2.5 h-2.5" />
                        {lead.openedEmailCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    className="p-1 rounded hover:bg-surface-3 text-text-3 hover:text-text-1 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {openMenu === lead.id && (
                    <div
                      className="absolute right-2 top-full mt-1 z-20 w-40 bg-surface border border-border rounded-lg shadow-xl py-1"
                      onMouseLeave={() => setOpenMenu(null)}
                    >
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-2 hover:text-text-1 hover:bg-surface-2 transition-colors"
                      >
                        View Details
                      </Link>
                      <button
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-2 hover:text-text-1 hover:bg-surface-2 w-full text-left transition-colors"
                        onClick={() => { onArchive(lead.id); setOpenMenu(null) }}
                      >
                        <Archive className="w-3 h-3" />
                        {lead.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                      </button>
                      <button
                        className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 w-full text-left transition-colors"
                        onClick={() => { setConfirmDelete(lead.id); setOpenMenu(null) }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <h3 className="text-base font-semibold text-text-1 mb-2">Delete Lead?</h3>
            <p className="text-sm text-text-2 mb-5">
              This will permanently delete the lead and all associated emails. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null) }}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
