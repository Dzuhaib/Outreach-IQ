import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateEmail } from '@/lib/ai'
import type { EmailType, WebsiteAnalysis } from '@/lib/types'

// Allow up to 30s for OpenAI email generation
export const maxDuration = 30

type Params = Promise<{ id: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    const { type = 'INITIAL' } = await request.json() as { type?: EmailType }

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.analysis) {
      return NextResponse.json(
        { error: 'Website must be analyzed before generating an email' },
        { status: 400 },
      )
    }

    const settings = await prisma.settings.findFirst()
    const analysis: WebsiteAnalysis = JSON.parse(lead.analysis)

    const { subject, body } = await generateEmail({
      businessName: lead.businessName,
      city: lead.city,
      niche: lead.niche,
      websiteUrl: lead.websiteUrl,
      analysis,
      type,
      senderName: settings?.senderName || null,
      signature: settings?.signature || null,
    })

    // Replace existing draft of this type if it hasn't been sent yet
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Email generation failed' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    const { emailId, subject, body } = await request.json() as {
      emailId: string
      subject: string
      body: string
    }

    if (!emailId || !subject || !body) {
      return NextResponse.json({ error: 'emailId, subject, and body are required' }, { status: 400 })
    }

    const email = await prisma.email.findFirst({ where: { id: emailId, leadId: id } })
    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    if (email.sentAt) return NextResponse.json({ error: 'Cannot edit a sent email' }, { status: 400 })

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { subject: subject.trim(), body: body.trim() },
    })

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    )
  }
}
