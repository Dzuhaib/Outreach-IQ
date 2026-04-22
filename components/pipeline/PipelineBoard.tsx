'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge'
import { ACTIVE_STATUSES, STATUS_LABELS, formatDate } from '@/lib/utils'
import type { LeadListItem, LeadStatus } from '@/lib/types'

interface PipelineBoardProps {
  leads: LeadListItem[]
}

export function PipelineBoard({ leads }: PipelineBoardProps) {
  const byStatus = ACTIVE_STATUSES.reduce<Record<string, LeadListItem[]>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s)
    return acc
  }, {})

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
      {ACTIVE_STATUSES.map((status) => {
        const items = byStatus[status]
        return (
          <div key={status} className="w-64 shrink-0 flex flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-lg">
              <LeadStatusBadge status={status as LeadStatus} />
              <span className="text-xs text-text-3 font-medium">{items.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {items.map((lead) => (
                <PipelineCard key={lead.id} lead={lead} />
              ))}
              {items.length === 0 && (
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <p className="text-xs text-text-3">No leads</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PipelineCard({ lead }: { lead: LeadListItem }) {
  return (
    <Link href={`/leads/${lead.id}`}>
      <div className="bg-surface border border-border rounded-lg p-3 hover:border-border-2 hover:bg-surface-2 transition-all cursor-pointer group">
        <p className="text-sm font-medium text-text-1 group-hover:text-accent transition-colors leading-tight">
          {lead.businessName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {lead.city && <span className="text-xs text-text-3">{lead.city}</span>}
          {lead.city && lead.niche && <span className="text-text-3">·</span>}
          {lead.niche && <span className="text-xs text-text-3">{lead.niche}</span>}
        </div>
        {lead.websiteUrl && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-text-3">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate max-w-[160px]">
              {lead.websiteUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
        )}
        <p className="text-xs text-text-3 mt-2">{formatDate(lead.createdAt)}</p>
      </div>
    </Link>
  )
}
