import OpenAI from 'openai'
import { prisma } from './db'
import { stripHtml, DEFAULT_OPENAI_MODEL } from './utils'
import type { WebsiteAnalysis } from './types'

async function getClient(): Promise<{ client: OpenAI; model: string }> {
  const settings = await prisma.settings.findFirst()
  const apiKey = settings?.openaiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.')
  }
  const model = settings?.openaiModel || DEFAULT_OPENAI_MODEL
  return { client: new OpenAI({ apiKey }), model }
}

/** Fetch a URL and extract its plain-text content for analysis */
async function fetchWebsiteContent(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
    })
    const html = await res.text()
    const text = stripHtml(html)
    return text.slice(0, 8000)
  } finally {
    clearTimeout(timeout)
  }
}

export async function analyzeWebsite(
  url: string,
  businessName: string,
): Promise<WebsiteAnalysis> {
  const { client, model } = await getClient()

  let websiteContent = ''
  try {
    websiteContent = await fetchWebsiteContent(url)
  } catch {
    websiteContent = 'Could not fetch website content — analyze based on URL structure only.'
  }

  const prompt = `You are a website analyst for a web development agency identifying problems with small business websites.

Analyze this website and find specific, actionable problems that hurt their business:

Business: ${businessName}
URL: ${url}
Website content (truncated): ${websiteContent}

Look for issues in these areas:
1. Design (outdated, poor mobile responsiveness, bad UX)
2. Missing features (no chatbot, no booking system, no live chat, no contact form)
3. SEO (missing meta tags, thin content, poor structure, no blog)
4. Performance (signs of slow loading, large unoptimized images)
5. Trust signals (no testimonials, no reviews, no certifications, no team page)
6. Conversion (weak CTAs, confusing nav, no clear value proposition)

Respond ONLY with valid JSON in this exact format:
{
  "summary": "2-3 sentence assessment of the website's overall state",
  "painPoints": [
    {
      "category": "Design|SEO|Performance|Features|Trust|Conversion",
      "description": "Specific problem in 1-2 sentences",
      "severity": "low|medium|high"
    }
  ],
  "score": 0
}

Rules:
- Identify 3-6 specific pain points
- score: 0-100 where higher = better website quality
- Be concrete, not generic ("No Google Analytics tracking" not "missing analytics")
- Only output the JSON object, nothing else`

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI returned invalid analysis format')

  return JSON.parse(jsonMatch[0]) as WebsiteAnalysis
}

export async function generateEmail(params: {
  businessName: string
  city: string | null
  niche: string | null
  websiteUrl: string | null
  analysis: WebsiteAnalysis
  type: 'INITIAL' | 'FOLLOW_UP_3' | 'FOLLOW_UP_7'
  senderName: string | null
  signature: string | null
}): Promise<{ subject: string; body: string }> {
  const { client, model } = await getClient()

  const painPointsSummary = params.analysis.painPoints
    .filter((p) => p.severity !== 'low')
    .slice(0, 3)
    .map((p) => `- ${p.category}: ${p.description}`)
    .join('\n')

  const isFollowUp = params.type !== 'INITIAL'
  const followUpContext =
    params.type === 'FOLLOW_UP_3'
      ? 'This is a 3-day follow-up. They did not reply to the first email. Keep it short and reference the original.'
      : params.type === 'FOLLOW_UP_7'
      ? 'This is a 7-day follow-up / last touch. They have not replied. Make it very short — 2-3 sentences max.'
      : ''

  const prompt = `You are writing a cold outreach email for a web development agency.

Business: ${params.businessName}
City: ${params.city || 'unknown location'}
Industry: ${params.niche || 'unknown industry'}
Website: ${params.websiteUrl || 'no website'}
${isFollowUp ? followUpContext : ''}

Problems found on their website:
${painPointsSummary || '- General website improvements needed'}

Write a ${isFollowUp ? 'follow-up' : 'cold'} email that:
- Opens with something specific about THEIR business
- Mentions 1-2 specific problems you noticed
- Briefly explains the benefit of fixing them
- Has a low-pressure CTA (curious question, not "book a call now")
- Is max ${isFollowUp ? '80' : '150'} words
- Sounds like a real person wrote it quickly, not a marketing team
- Uses NO buzzwords: leverage, synergy, solutions, game-changer, innovative
- Sender: ${params.senderName || 'the team'}

${params.signature ? `Signature to include:\n${params.signature}` : ''}

Respond ONLY with valid JSON:
{
  "subject": "email subject line",
  "body": "full email body with actual line breaks using \\n"
}

Only output the JSON object, nothing else.`

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI returned invalid email format')

  return JSON.parse(jsonMatch[0]) as { subject: string; body: string }
}
