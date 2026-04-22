import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { ALL_STATUSES } from '@/lib/utils'
import type { LeadStatus } from '@/lib/types'

export async function GET() {
  try {
    const user = await requireUser()
    const userId = user.id

    const [leads, sentEmails, openedEmails, leadsWithOpens] = await Promise.all([
      prisma.lead.findMany({ where: { userId }, select: { status: true } }),
      prisma.email.count({
        where: { sentAt: { not: null }, lead: { userId } },
      }),
      prisma.email.count({
        where: { openedAt: { not: null }, lead: { userId } },
      }),
      prisma.lead.count({
        where: { userId, emails: { some: { openedAt: { not: null } } } },
      }),
    ])

    const byStatus = ALL_STATUSES.reduce<Record<LeadStatus, number>>(
      (acc, s) => { acc[s] = 0; return acc },
      {} as Record<LeadStatus, number>,
    )
    leads.forEach((l) => {
      const s = l.status as LeadStatus
      if (s in byStatus) byStatus[s]++
    })

    const total = leads.length
    const replied = byStatus.REPLIED + byStatus.CONVERTED
    const converted = byStatus.CONVERTED

    return NextResponse.json({
      totalLeads: total,
      emailsSent: sentEmails,
      emailsOpened: openedEmails,
      openRate: sentEmails > 0 ? Math.round((openedEmails / sentEmails) * 100) : 0,
      replied,
      converted,
      replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      byStatus,
      leadsWithOpens,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}
