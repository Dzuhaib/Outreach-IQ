'use client'

import { useEffect, useState } from 'react'
import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Kanban } from 'lucide-react'
import type { LeadListItem } from '@/lib/types'

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/leads')
        if (!res.ok) throw new Error('Failed to load pipeline')
        const data = await res.json()
        setLeads(data.leads.filter((l: LeadListItem) => l.status !== 'ARCHIVED'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-1 tracking-tight">Pipeline</h1>
        <p className="text-sm text-text-2 mt-1">Track leads through your outreach stages</p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <PageLoader text="Loading pipeline…" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title="Pipeline is empty"
          description="Add leads to start tracking your outreach progress."
        />
      ) : (
        <PipelineBoard leads={leads} />
      )}
    </div>
  )
}
