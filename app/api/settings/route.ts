import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json({
      googleEmail: user.googleEmail,
      openaiKey: user.openaiKey,
      openaiModel: user.openaiModel,
      senderName: user.senderName,
      signature: user.signature,
      followUpDay3: user.followUpDay3,
      followUpDay7: user.followUpDay7,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json() as Record<string, unknown>

    const data: Record<string, unknown> = {}
    if ('openaiKey' in body) data.openaiKey = body.openaiKey ? String(body.openaiKey).trim() : null
    if ('openaiModel' in body) data.openaiModel = body.openaiModel ? String(body.openaiModel) : null
    if ('senderName' in body) data.senderName = body.senderName ? String(body.senderName).trim() : null
    if ('signature' in body) data.signature = body.signature ? String(body.signature) : null
    if ('followUpDay3' in body) data.followUpDay3 = Number(body.followUpDay3) || 3
    if ('followUpDay7' in body) data.followUpDay7 = Number(body.followUpDay7) || 7

    await prisma.user.update({ where: { id: user.id }, data })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status })
  }
}
