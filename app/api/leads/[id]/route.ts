import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import type { WebsiteAnalysis } from '@/lib/types'

type Params = Promise<{ id: string }>

function parseLead(lead: {
  analysis: string | null
  emails: unknown[]
  [key: string]: unknown
}) {
  let parsed: WebsiteAnalysis | null = null
  if (lead.analysis) {
    try { parsed = JSON.parse(lead.analysis) } catch { parsed = null }
  }
  return { ...lead, analysis: parsed }
}

async function getOwnedLead(userId: string, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, userId } })
  return lead
}

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const lead = await prisma.lead.findFirst({
      where: { id, userId: user.id },
      include: { emails: { orderBy: { createdAt: 'asc' } } },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json(parseLead(lead))
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const owned = await getOwnedLead(user.id, id)
    if (!owned) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const body = await request.json() as Record<string, unknown>

    const updatable: Record<string, unknown> = {}
    if ('businessName' in body) updatable.businessName = String(body.businessName).trim()
    if ('websiteUrl' in body) updatable.websiteUrl = body.websiteUrl ? String(body.websiteUrl).trim() : null
    if ('city' in body) updatable.city = body.city ? String(body.city).trim() : null
    if ('niche' in body) updatable.niche = body.niche ? String(body.niche).trim() : null
    if ('email' in body) updatable.email = body.email ? String(body.email).trim() : null
    if ('status' in body) {
      updatable.status = String(body.status)
      if (body.status === 'ARCHIVED') updatable.archivedAt = new Date()
      else if ('archivedAt' in updatable || body.status !== 'ARCHIVED') updatable.archivedAt = null
    }
    if ('notes' in body) updatable.notes = body.notes ? String(body.notes) : null

    const lead = await prisma.lead.update({
      where: { id },
      data: updatable,
      include: { emails: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json(parseLead(lead))
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}

export async function DELETE(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const owned = await getOwnedLead(user.id, id)
    if (!owned) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    await prisma.lead.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}
