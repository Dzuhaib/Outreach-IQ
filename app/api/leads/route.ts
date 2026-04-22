import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { LeadStatus } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as LeadStatus | null
    const city = searchParams.get('city') || ''
    const niche = searchParams.get('niche') || ''
    const limit = parseInt(searchParams.get('limit') || '200')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { city: { contains: search } },
        { niche: { contains: search } },
        { email: { contains: search } },
      ]
    }
    if (status) where.status = status
    if (city) where.city = { contains: city }
    if (niche) where.niche = { contains: niche }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        businessName: true,
        websiteUrl: true,
        city: true,
        niche: true,
        email: true,
        status: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { emails: true } },
      },
    })

    return NextResponse.json({ leads })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      businessName: string
      websiteUrl?: string
      city?: string
      niche?: string
      email?: string
      notes?: string
    }

    if (!body.businessName?.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const lead = await prisma.lead.create({
      data: {
        businessName: body.businessName.trim(),
        websiteUrl: body.websiteUrl?.trim() || null,
        city: body.city?.trim() || null,
        niche: body.niche?.trim() || null,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
        status: 'NEW',
      },
      include: { emails: true },
    })

    return NextResponse.json({ ...lead, analysis: null }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create lead' },
      { status: 500 },
    )
  }
}
