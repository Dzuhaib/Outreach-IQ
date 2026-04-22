import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireUser()

    const emails = await prisma.email.findMany({
      where: {
        openedAt: { not: null },
        lead: { userId: user.id },
      },
      orderBy: { openedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        type: true,
        sentAt: true,
        openedAt: true,
        openCount: true,
        lead: {
          select: {
            id: true,
            businessName: true,
            email: true,
            niche: true,
            city: true,
          },
        },
      },
    })

    return NextResponse.json({ emails })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status },
    )
  }
}
