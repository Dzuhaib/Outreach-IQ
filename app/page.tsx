'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users, Mail, MessageSquare, TrendingUp, ArrowRight, BarChart3, Eye, MailOpen,
} from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { STATUS_LABELS, ACTIVE_STATUSES, formatDate } from '@/lib/utils'
import type { DashboardStats, LeadListItem, LeadStatus } from '@/lib/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, leadsRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/leads?limit=5&sort=createdAt&dir=desc'),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (leadsRes.ok) {
          const data = await leadsRes.json()
          setRecentLeads(data.leads)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageLoader text="Loading dashboard…" />

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-1 tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-2 mt-1">Your outreach pipeline at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatsCard
          title="Total Leads"
          value={stats?.totalLeads ?? 0}
          icon={Users}
          accent
        />
        <StatsCard
          title="Emails Sent"
          value={stats?.emailsSent ?? 0}
          icon={Mail}
        />
        <StatsCard
          title="Open Rate"
          value={stats ? `${stats.openRate}%` : '0%'}
          subtitle={`${stats?.emailsOpened ?? 0} opened`}
          icon={Eye}
          href="/opened"
        />
        <StatsCard
          title="Reply Rate"
          value={stats ? `${stats.replyRate}%` : '0%'}
          subtitle={`${stats?.replied ?? 0} replied`}
          icon={MessageSquare}
        />
        <StatsCard
          title="Conversion Rate"
          value={stats ? `${stats.conversionRate}%` : '0%'}
          subtitle={`${stats?.converted ?? 0} converted`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status breakdown */}
        <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-text-2" />
            <h2 className="text-sm font-semibold text-text-1">Pipeline Breakdown</h2>
          </div>
          <div className="space-y-2">
            {ACTIVE_STATUSES.map((status) => {
              const count = stats?.byStatus[status] ?? 0
              const total = stats?.totalLeads ?? 1
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-2">{STATUS_LABELS[status]}</span>
                    <span className="text-xs font-medium text-text-1">{count}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Email opens — always shown, links to /opened */}
            <div className="pt-2 mt-2 border-t border-border">
              <Link href="/opened" className="block group">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs text-blue-400 group-hover:text-blue-300 transition-colors">
                    <MailOpen className="w-3 h-3" />
                    Email Opened
                  </span>
                  <span className="text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                    {stats?.leadsWithOpens ?? 0}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(stats?.totalLeads ?? 0) > 0 ? Math.round(((stats?.leadsWithOpens ?? 0) / stats!.totalLeads) * 100) : 0}%` }}
                  />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent leads */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-1">Recent Leads</h2>
            <Link href="/leads">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-3">No leads yet.</p>
              <Link href="/leads" className="text-sm text-accent hover:underline mt-1 inline-block">
                Add your first lead →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}>
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-2 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-text-1 group-hover:text-accent transition-colors">
                        {lead.businessName}
                      </p>
                      <p className="text-xs text-text-3">
                        {[lead.city, lead.niche].filter(Boolean).join(' · ') || 'No details'}
                        {' · '}
                        {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <LeadStatusBadge status={lead.status as LeadStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
