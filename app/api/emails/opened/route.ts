import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      where: { openedAt: { not: null } },
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
