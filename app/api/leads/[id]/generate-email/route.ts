import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateEmail } from '@/lib/ai'
import { requireUser } from '@/lib/session'
import type { EmailType, WebsiteAnalysis, RichAnalysis } from '@/lib/types'

// Allow up to 30s for OpenAI email generation
export const maxDuration = 30

type Params = Promise<{ id: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { type = 'INITIAL' } = await request.json() as { type?: EmailType }

    const lead = await prisma.lead.findFirst({ where: { id, userId: user.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.analysis) {
      return NextResponse.json(
        { error: 'Website must be analyzed before generating an email' },
        { status: 400 },
      )
    }

    const analysis: WebsiteAnalysis | RichAnalysis = JSON.parse(lead.analysis)

    // For follow-ups, fetch the initial email's open count to personalise the message
    let initialOpenCount = 0
    if (type !== 'INITIAL') {
      const initialEmail = await prisma.email.findFirst({
        where: { leadId: id, type: 'INITIAL' },
        select: { openCount: true },
      })
      initialOpenCount = initialEmail?.openCount ?? 0
    }

    const { subject, body } = await generateEmail({
      businessName: lead.businessName,
      city: lead.city,
      niche: lead.niche,
      websiteUrl: lead.websiteUrl,
      analysis,
      type,
      openCount: initialOpenCount,
      senderName: user.senderName,
      signature: user.signature,
      userId: user.id,
    })

    const existing = await prisma.email.findFirst({
      where: { leadId: id, type, sentAt: null },
    })

    let email
    if (existing) {
      email = await prisma.email.update({
        where: { id: existing.id },
        data: { subject, body },
      })
    } else {
      email = await prisma.email.create({
        data: { leadId: id, subject, body, type },
      })
    }

    return NextResponse.json(email)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Email generation failed' },
      { status },
    )
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { emailId, subject, body } = await request.json() as {
      emailId: string
      subject: string
      body: string
    }

    if (!emailId || !subject || !body) {
      return NextResponse.json({ error: 'emailId, subject, and body are required' }, { status: 400 })
    }

    const lead = await prisma.lead.findFirst({ where: { id, userId: user.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const email = await prisma.email.findFirst({ where: { id: emailId, leadId: id } })
    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    if (email.sentAt) return NextResponse.json({ error: 'Cannot edit a sent email' }, { status: 400 })

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { subject: subject.trim(), body: body.trim() },
    })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status },
    )
  }
}
