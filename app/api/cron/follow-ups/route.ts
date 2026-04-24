import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateEmail } from '@/lib/ai'
import { sendEmail, checkThreadForReply } from '@/lib/email'
import type { RichAnalysis, WebsiteAnalysis } from '@/lib/types'

// Vercel cron: set maxDuration to 300s on Pro, 60s on Hobby
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = { repliesDetected: 0, followUp3Sent: 0, followUp7Sent: 0, errors: 0 }
  const now = new Date()

  const users = await prisma.user.findMany({
    where: { googleRefreshToken: { not: null } },
  })

  for (const user of users) {
    const day3Cutoff = new Date(now.getTime() - user.followUpDay3 * 24 * 60 * 60 * 1000)
    const day7Cutoff = new Date(now.getTime() - user.followUpDay7 * 24 * 60 * 60 * 1000)

    // ── 1. Detect replies via Gmail thread check ────────────────────────────
    try {
      const leadsToCheck = await prisma.lead.findMany({
        where: {
          userId: user.id,
          status: { in: ['EMAIL_SENT', 'FOLLOWED_UP'] },
          email: { not: null },
          emails: {
            some: { type: 'INITIAL', sentAt: { not: null }, gmailThreadId: { not: null } },
          },
        },
        include: {
          emails: {
            where: { type: 'INITIAL', sentAt: { not: null }, gmailThreadId: { not: null } },
            select: { sentAt: true, gmailThreadId: true },
          },
        },
      })

      for (const lead of leadsToCheck) {
        const initial = lead.emails[0]
        if (!initial?.gmailThreadId || !initial.sentAt) continue
        try {
          const replied = await checkThreadForReply({
            threadId: initial.gmailThreadId,
            userId: user.id,
            sentAt: initial.sentAt,
            leadEmail: lead.email!,
          })
          if (replied) {
            await prisma.lead.update({ where: { id: lead.id }, data: { status: 'REPLIED' } })
            results.repliesDetected++
          }
        } catch { /* skip this lead */ }
      }
    } catch { /* skip reply check for this user */ }

    // ── 2. Send FOLLOW_UP_3 ────────────────────────────────────────────────
    try {
      const fu3Candidates = await prisma.lead.findMany({
        where: {
          userId: user.id,
          status: 'EMAIL_SENT',
          email: { not: null },
          analysis: { not: null },
          emails: {
            some: { type: 'INITIAL', sentAt: { not: null, lte: day3Cutoff } },
            none: { type: 'FOLLOW_UP_3' },
          },
        },
        include: {
          emails: {
            where: { type: 'INITIAL', sentAt: { not: null } },
            select: { openCount: true },
          },
        },
      })

      for (const lead of fu3Candidates) {
        try {
          const analysis: WebsiteAnalysis | RichAnalysis = JSON.parse(lead.analysis!)
          const openCount = lead.emails[0]?.openCount ?? 0

          const { subject, body } = await generateEmail({
            businessName: lead.businessName,
            city: lead.city,
            niche: lead.niche,
            websiteUrl: lead.websiteUrl,
            analysis,
            type: 'FOLLOW_UP_3',
            openCount,
            senderName: user.senderName,
            signature: user.signature,
            userId: user.id,
          })

          const emailRecord = await prisma.email.create({
            data: { leadId: lead.id, subject, body, type: 'FOLLOW_UP_3' },
          })

          const { threadId } = await sendEmail({
            to: lead.email!,
            subject,
            body,
            emailId: emailRecord.id,
            userId: user.id,
          })

          await prisma.$transaction([
            prisma.email.update({ where: { id: emailRecord.id }, data: { sentAt: now, gmailThreadId: threadId } }),
            prisma.lead.update({ where: { id: lead.id }, data: { status: 'FOLLOWED_UP' } }),
          ])

          results.followUp3Sent++
        } catch {
          results.errors++
        }
      }
    } catch { /* skip FU3 for this user */ }

    // ── 3. Send FOLLOW_UP_7 ────────────────────────────────────────────────
    try {
      const fu7Candidates = await prisma.lead.findMany({
        where: {
          userId: user.id,
          status: 'FOLLOWED_UP',
          email: { not: null },
          analysis: { not: null },
          emails: {
            none: { type: 'FOLLOW_UP_7' },
          },
        },
        include: {
          emails: {
            where: { sentAt: { not: null } },
            select: { type: true, sentAt: true, openCount: true },
          },
        },
      })

      for (const lead of fu7Candidates) {
        const initialEmail = lead.emails.find((e) => e.type === 'INITIAL')
        const fu3Email = lead.emails.find((e) => e.type === 'FOLLOW_UP_3')
        if (!initialEmail?.sentAt || !fu3Email?.sentAt) continue
        if (new Date(initialEmail.sentAt) > day7Cutoff) continue

        try {
          const analysis: WebsiteAnalysis | RichAnalysis = JSON.parse(lead.analysis!)
          const openCount = initialEmail.openCount ?? 0

          const { subject, body } = await generateEmail({
            businessName: lead.businessName,
            city: lead.city,
            niche: lead.niche,
            websiteUrl: lead.websiteUrl,
            analysis,
            type: 'FOLLOW_UP_7',
            openCount,
            senderName: user.senderName,
            signature: user.signature,
            userId: user.id,
          })

          const emailRecord = await prisma.email.create({
            data: { leadId: lead.id, subject, body, type: 'FOLLOW_UP_7' },
          })

          const { threadId } = await sendEmail({
            to: lead.email!,
            subject,
            body,
            emailId: emailRecord.id,
            userId: user.id,
          })

          await prisma.$transaction([
            prisma.email.update({ where: { id: emailRecord.id }, data: { sentAt: now, gmailThreadId: threadId } }),
          ])

          results.followUp7Sent++
        } catch {
          results.errors++
        }
      }
    } catch { /* skip FU7 for this user */ }
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
}
