import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWebsite } from '@/lib/ai'

// Allow up to 60s — website fetch + AI analysis can take 20-30s
export const maxDuration = 60

type Params = Promise<{ id: string }>

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.websiteUrl) {
      return NextResponse.json({ error: 'This lead has no website URL to analyze' }, { status: 400 })
    }

    const analysis = await analyzeWebsite(lead.websiteUrl, lead.businessName)

    await prisma.lead.update({
      where: { id },
      data: {
        analysis: JSON.stringify(analysis),
        status: 'ANALYZED',
      },
    })

    return NextResponse.json({ analysis })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    )
  }
}
