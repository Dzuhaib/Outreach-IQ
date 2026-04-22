import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

type Params = Promise<{ id: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    const { emailId } = await request.json() as { emailId: string }

    if (!emailId) return NextResponse.json({ error: 'emailId is required' }, { status: 400 })

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.email) {
      return NextResponse.json({ error: 'This lead has no email address' }, { status: 400 })
    }

    const email = await prisma.email.findFirst({ where: { id: emailId, leadId: id } })
    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    if (email.sentAt) return NextResponse.json({ error: 'This email has already been sent' }, { status: 400 })

    await sendEmail({ to: lead.email, subject: email.subject, body: email.body, emailId })

    const now = new Date()

    // Update email and lead status atomically
    const newLeadStatus =
      email.type === 'INITIAL' ? 'EMAIL_SENT' :
      'FOLLOWED_UP'

    await prisma.$transaction([
      prisma.email.update({ where: { id: emailId }, data: { sentAt: now } }),
      prisma.lead.update({ where: { id }, data: { status: newLeadStatus } }),
    ])

    return NextResponse.json({ success: true, sentAt: now.toISOString() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 },
    )
  }
}
