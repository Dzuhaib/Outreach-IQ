import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 1×1 transparent GIF — standard tracking pixel
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

type Params = Promise<{ emailId: string }>

export async function GET(_: Request, { params }: { params: Params }) {
  const { emailId } = await params

  // Record open asynchronously — don't let DB errors block the pixel response
  prisma.email.updateMany({
    where: { id: emailId, sentAt: { not: null } },
    data: {
      // Only stamp openedAt on the first open
      openedAt: undefined, // handled below
      openCount: { increment: 1 },
    },
  }).then(async () => {
    // Set openedAt only if this is the first open
    await prisma.email.updateMany({
      where: { id: emailId, openedAt: null, sentAt: { not: null } },
      data: { openedAt: new Date() },
    })
  }).catch(() => {
    // Silently ignore — never break email rendering for tracking failures
  })

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
