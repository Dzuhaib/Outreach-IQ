import { NextResponse } from 'next/server'
import { verifyGmail } from '@/lib/email'
import { requireUser } from '@/lib/session'

export async function POST() {
  try {
    const user = await requireUser()
    const email = await verifyGmail(user.id)
    return NextResponse.json({ success: true, email })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 400
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gmail verification failed' },
      { status },
    )
  }
}
