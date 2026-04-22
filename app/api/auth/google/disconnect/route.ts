import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const SETTINGS_ID = 'singleton'

export async function POST() {
  try {
    await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        googleEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      },
      create: { id: SETTINGS_ID },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to disconnect' },
      { status: 500 },
    )
  }
}
