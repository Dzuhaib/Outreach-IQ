import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWebsite } from '@/lib/ai'
import type { AnalysisType } from '@/lib/types'

// Website fetch + up to 3 AI calls can take 45-60s
export const maxDuration = 60

type Params = Promise<{ id: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params

    let types: AnalysisType[] = ['chatbot', 'website', 'seo']
    try {
      const body = await request.json() as { types?: AnalysisType[] }
      if (Array.isArray(body.types) && body.types.length > 0) types = body.types
    } catch { /* body is optional */ }

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.websiteUrl) {
      return NextResponse.json({ error: 'This lead has no website URL to analyze' }, { status: 400 })
    }

    const analysis = await analyzeWebsite(lead.websiteUrl, lead.businessName, types)

    await prisma.lead.update({
      where: { id },
      data: { analysis: JSON.stringify(analysis), status: 'ANALYZED' },
    })

    return NextResponse.json({ analysis })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    )
  }
}
