import { NextResponse } from 'next/server'

// SMTP has been replaced by Gmail OAuth. This endpoint is no longer used.
export async function POST() {
  return NextResponse.json({ error: 'SMTP is no longer used. Connect Gmail in Settings.' }, { status: 410 })
}
