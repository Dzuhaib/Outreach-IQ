import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const SETTINGS_ID = 'singleton'

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst()
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: SETTINGS_ID } })
    }
    return NextResponse.json(settings)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>

    const data: Record<string, unknown> = {}
    if ('openaiKey' in body) data.openaiKey = body.openaiKey ? String(body.openaiKey).trim() : null
    if ('openaiModel' in body) data.openaiModel = body.openaiModel ? String(body.openaiModel) : null
    if ('senderName' in body) data.senderName = body.senderName ? String(body.senderName).trim() : null
    if ('signature' in body) data.signature = body.signature ? String(body.signature) : null
    if ('followUpDay3' in body) data.followUpDay3 = Number(body.followUpDay3) || 3
    if ('followUpDay7' in body) data.followUpDay7 = Number(body.followUpDay7) || 7

    const settings = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    })

    return NextResponse.json(settings)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
