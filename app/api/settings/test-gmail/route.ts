import { NextResponse } from 'next/server'
import { verifyGmail } from '@/lib/email'

export async function POST() {
  try {
    const email = await verifyGmail()
    return NextResponse.json({ success: true, email })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gmail verification failed' },
      { status: 400 },
    )
  }
}
