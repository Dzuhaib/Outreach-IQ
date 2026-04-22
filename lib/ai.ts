import OpenAI from 'openai'
import { prisma } from './db'
import { stripHtml, DEFAULT_OPENAI_MODEL } from './utils'
import type {
  WebsiteAnalysis, RichAnalysis, AnalysisType,
  ChatbotResult, WebsiteResult, SEOResult, PainPoint,
} from './types'

async function getClient(): Promise<{ client: OpenAI; model: string }> {
  const settings = await prisma.settings.findFirst()
  const apiKey = settings?.openaiKey || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured. Please add it in Settings.')
  const model = settings?.openaiModel || DEFAULT_OPENAI_MODEL
  return { client: new OpenAI({ apiKey }), model }
}

async function fetchWebsiteHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
    })
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

// Chatbot detection — pure string matching, no AI call needed
function detectChatbot(html: string): ChatbotResult {
  const PLATFORMS: Record<string, string[]> = {
    Intercom: ['intercom.io', 'widget.intercom', 'Intercom('],
    Drift: ['js.driftt.com', 'drift.com/widget', 'window.drift'],
    Zendesk: ['zendesk.com/embeddable', 'zopim', 'ze.t('],
    Crisp: ['client.crisp.chat', 'window.$crisp'],
    Tidio: ['code.tidio.co'],
    LiveChat: ['livechatinc.com', 'window.__lc'],
    HubSpot: ['js.hs-scripts.com', 'hsConversationsSettings'],
    Tawk: ['embed.tawk.to'],
    Freshchat: ['wchat.freshchat.com'],
    Olark: ['static.olark.com'],
    Smartsupp: ['smartsupp.com'],
    Chaport: ['chaport.com'],
    Userlike: ['userlike.com'],
  }
  for (const [platform, sigs] of Object.entries(PLATFORMS)) {
    if (sigs.some((s) => html.includes(s))) return { hasChatbot: true, platform }
  }
  return { hasChatbot: false }
}

async function analyzeWebsiteIssues(
  html: string,
  url: string,
  businessName: string,
  client: OpenAI,
  model: string,
): Promise<WebsiteResult> {
  const hasSSL = url.startsWith('https://')
  const hasMobileViewport = /viewport.*width=device-width/i.test(html)
  const snippet = stripHtml(html).slice(0, 5000)

  const prompt = `You are a senior web developer auditing a small business website to find problems worth fixing.

Business: ${businessName}
URL: ${url}
Has HTTPS: ${hasSSL}
Has mobile viewport meta: ${hasMobileViewport}
Page text (truncated):
${snippet}

Find specific, actionable issues in these areas:
1. Mobile responsiveness — missing viewport, layout breaks on small screens, fixed widths
2. Outdated design — table-based layouts, old fonts, Flash references, no modern CSS
3. Performance — no lazy loading hints, large unoptimised image references, render-blocking resources
4. Missing or broken images — img tags without src, broken image references
5. Accessibility — missing alt text on important images, poor heading hierarchy for screen readers
6. Trust signals — no reviews section, no team page, no SSL, no certifications visible
7. CTAs & UX — weak or missing calls to action, confusing navigation, no contact form
8. Content gaps — no blog, very thin copy, no value proposition

Respond ONLY with valid JSON matching this exact schema:
{
  "score": 45,
  "mobileReady": false,
  "issues": [
    { "category": "Mobile|Design|Performance|Images|Accessibility|Trust|CTA|Content", "description": "one specific sentence", "severity": "low|medium|high" }
  ]
}
Rules: score 0-100 (higher = better), 4-7 issues, be concrete and specific.`

  const res = await client.chat.completions.create({
    model, max_tokens: 900, temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = res.choices[0]?.message?.content || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Invalid website analysis response')
  const parsed = JSON.parse(m[0])
  return {
    score: parsed.score ?? 50,
    mobileReady: parsed.mobileReady ?? hasMobileViewport,
    hasSSL,
    issues: parsed.issues || [],
  }
}

async function analyzeSEO(
  html: string,
  url: string,
  businessName: string,
  client: OpenAI,
  model: string,
): Promise<SEOResult> {
  // Parse structural signals directly from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || ''

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  const metaDescription = metaDescMatch?.[1]?.trim() || ''

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length
  const hasCanonical = /rel=["']canonical["']/i.test(html)
  const hasSchema = html.includes('application/ld+json')
  const schemaTypeMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || []
  const schemaTypes = [
    ...new Set(
      schemaTypeMatches.map((m) => m.replace(/"@type"\s*:\s*"/, '').replace(/"$/, ''))
    ),
  ]
  const imgTags = html.match(/<img[^>]*>/gi) || []
  const imagesWithoutAlt = imgTags.filter((img) => !/alt=["'][^"']+["']/i.test(img)).length
  const textContent = stripHtml(html)
  const estimatedWordCount = textContent.split(/\s+/).filter((w) => w.length > 2).length

  const prompt = `You are an SEO expert auditing a small business website for an agency.

Business: ${businessName}
URL: ${url}

Pre-parsed technical signals:
- Title tag: "${title}" (${title.length} chars — ideal 50-60)
- Meta description: "${metaDescription ? metaDescription.slice(0, 120) : 'MISSING'}" (${metaDescription.length} chars — ideal 150-160)
- H1 count: ${h1Count} (should be exactly 1), H2: ${h2Count}, H3: ${h3Count}
- Canonical tag: ${hasCanonical ? 'yes' : 'missing'}
- JSON-LD schema: ${hasSchema ? `yes — types detected: ${schemaTypes.slice(0, 6).join(', ') || 'unknown'}` : 'missing'}
- Images missing alt text: ${imagesWithoutAlt}
- Estimated page word count: ${estimatedWordCount} (thin content = below 300 words)

Page content sample:
${textContent.slice(0, 2800)}

Identify specific SEO weaknesses AND any genuine strengths.
Respond ONLY with valid JSON:
{
  "score": 38,
  "issues": ["specific SEO issue in one sentence", "..."],
  "strengths": ["specific SEO strength if truly present", "..."]
}
Rules: score 0-100, 3-6 issues, 0-3 strengths (only if genuinely present), be specific.`

  const res = await client.chat.completions.create({
    model, max_tokens: 700, temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })
  const text2 = res.choices[0]?.message?.content || ''
  const m2 = text2.match(/\{[\s\S]*\}/)
  if (!m2) throw new Error('Invalid SEO analysis response')
  const ai = JSON.parse(m2[0])

  return {
    score: ai.score ?? 40,
    hasTitle: !!title,
    titleLength: title.length,
    hasMetaDescription: !!metaDescription,
    metaDescriptionLength: metaDescription.length,
    h1Count,
    h2Count,
    hasSchemaMarkup: hasSchema,
    schemaTypes,
    hasCanonical,
    imagesWithoutAlt,
    estimatedWordCount,
    issues: ai.issues || [],
    strengths: ai.strengths || [],
  }
}

export async function analyzeWebsite(
  url: string,
  businessName: string,
  types: AnalysisType[] = ['chatbot', 'website', 'seo'],
): Promise<RichAnalysis> {
  const { client, model } = await getClient()

  let html = ''
  try {
    html = await fetchWebsiteHtml(url)
  } catch {
    html = ''
  }

  const chatbot = types.includes('chatbot') ? detectChatbot(html) : undefined

  let website: WebsiteResult | undefined
  if (types.includes('website')) {
    try {
      website = await analyzeWebsiteIssues(html, url, businessName, client, model)
    } catch {
      website = { score: 50, mobileReady: false, hasSSL: url.startsWith('https://'), issues: [] }
    }
  }

  let seo: SEOResult | undefined
  if (types.includes('seo')) {
    try {
      seo = await analyzeSEO(html, url, businessName, client, model)
    } catch {
      seo = {
        score: 40, hasTitle: false, titleLength: 0, hasMetaDescription: false,
        metaDescriptionLength: 0, h1Count: 0, h2Count: 0, hasSchemaMarkup: false,
        schemaTypes: [], hasCanonical: false, imagesWithoutAlt: 0, estimatedWordCount: 0,
        issues: [], strengths: [],
      }
    }
  }

  // Overall score — average of whichever AI analyses ran
  const scores: number[] = []
  if (website) scores.push(website.score)
  if (seo) scores.push(seo.score)
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 50

  // Build pain points for email generation (backward-compat bridge)
  const painPoints: PainPoint[] = []
  if (chatbot && !chatbot.hasChatbot) {
    painPoints.push({
      category: 'Features',
      description: 'No live chat or chatbot detected — visitors may leave without a quick contact option.',
      severity: 'medium',
    })
  }
  website?.issues.forEach((issue) => {
    painPoints.push({ category: issue.category, description: issue.description, severity: issue.severity })
  })
  seo?.issues.slice(0, 3).forEach((issue) => {
    painPoints.push({ category: 'SEO', description: issue, severity: 'medium' })
  })

  // Generate plain-language summary
  const topIssues = painPoints.slice(0, 3).map((p) => p.description).join('; ')
  let summary = `${businessName} scored ${overallScore}/100 across ${types.length} analysis dimension(s).`
  try {
    const summaryRes = await client.chat.completions.create({
      model, max_tokens: 150, temperature: 0.4,
      messages: [{
        role: 'user',
        content: `Write exactly 2 sentences professionally summarising the website of "${businessName}" (${url}). Overall score: ${overallScore}/100. Key findings: ${topIssues || 'general improvements needed'}. Be specific, no fluff, no bullet points.`,
      }],
    })
    summary = summaryRes.choices[0]?.message?.content?.trim() || summary
  } catch { /* summary stays default */ }

  return {
    types,
    summary,
    score: overallScore,
    painPoints: painPoints.slice(0, 7),
    chatbot,
    website,
    seo,
  }
}

export async function generateEmail(params: {
  businessName: string
  city: string | null
  niche: string | null
  websiteUrl: string | null
  analysis: RichAnalysis | WebsiteAnalysis
  type: 'INITIAL' | 'FOLLOW_UP_3' | 'FOLLOW_UP_7'
  senderName: string | null
  signature: string | null
}): Promise<{ subject: string; body: string }> {
  const { client, model } = await getClient()

  const isFollowUp = params.type !== 'INITIAL'
  const followUpContext =
    params.type === 'FOLLOW_UP_3'
      ? 'This is a 3-day follow-up. They have not replied. Reference the previous email briefly. Keep it short.'
      : params.type === 'FOLLOW_UP_7'
      ? 'This is a final 7-day follow-up. Very short — 2-3 sentences max. Graceful last attempt.'
      : ''

  const rich = 'types' in params.analysis ? (params.analysis as RichAnalysis) : null
  const onlySEO = rich?.types.length === 1 && rich.types[0] === 'seo'
  const onlyChatbot = rich?.types.length === 1 && rich.types[0] === 'chatbot'
  const hasSEO = !!rich?.seo
  const sigBlock = params.signature ? `\nSignature to include:\n${params.signature}` : ''

  let prompt: string

  if (onlySEO && rich!.seo) {
    const seo = rich!.seo
    // SEO-only mode: proposal to win/beat their team — NEVER list technical problems
    prompt = `You are writing a cold outreach email for an SEO agency pitching to a small business.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Website: ${params.websiteUrl || 'unknown'}
Their SEO score: ${seo.score}/100
${isFollowUp ? followUpContext : ''}

IMPORTANT RULES for this SEO pitch:
- Do NOT list any SEO problems, missing tags, or technical issues — they will just fix it themselves
- Instead, position our agency as experts who will OUTPERFORM their current SEO situation
- Focus on RESULTS: rankings, traffic growth, leads from search, beating competitors
- Imply you spotted a competitive opportunity — do not reveal what it is
- Frame it as "here is what growth you are leaving on the table" not "here is what is broken"
- If they have an SEO team already, position us as being able to outperform them
- Low-pressure CTA — a genuine question, not "book a call"
- Max ${isFollowUp ? '70' : '130'} words
- Conversational, confident tone — not salesy
- Sender: ${params.senderName || 'the team'}${sigBlock}

Respond ONLY with valid JSON:
{ "subject": "subject line", "body": "email body with \\n for line breaks" }`

  } else if (onlyChatbot && rich!.chatbot) {
    const { hasChatbot, platform } = rich!.chatbot
    prompt = `You are writing a cold outreach email for a web agency specialising in chat and lead capture.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Website: ${params.websiteUrl || 'unknown'}
Has chatbot/live chat: ${hasChatbot ? `Yes — ${platform}` : 'No'}
${isFollowUp ? followUpContext : ''}

${hasChatbot
  ? `They already use ${platform}. Write an email about improving chat conversion rates, integrating with CRM, or upgrading their chat experience to capture more leads.`
  : 'They have no chatbot. Write about the leads they lose every day without instant response capability.'
}

Rules:
- Open with something specific about their business/industry
- One concrete business benefit (leads, availability, conversions)
- Low-pressure CTA — a genuine question
- Max ${isFollowUp ? '70' : '120'} words
- Sounds like a real person, no buzzwords
- Sender: ${params.senderName || 'the team'}${sigBlock}

Respond ONLY with valid JSON:
{ "subject": "subject line", "body": "email body with \\n for line breaks" }`

  } else {
    // General web dev pitch — website issues, or mixed analyses
    const analysis = params.analysis
    const painPoints = 'painPoints' in analysis ? analysis.painPoints : []
    const painPointsSummary = painPoints
      .filter((p) => p.severity !== 'low')
      .slice(0, 3)
      .map((p) => `- ${p.category}: ${p.description}`)
      .join('\n')

    // If SEO is included in a mixed analysis, don't reveal specific SEO issues
    const seoNote = hasSEO
      ? '\n- For any SEO points: stay vague, frame as a growth opportunity — never list specific SEO problems'
      : ''

    prompt = `You are writing a cold outreach email for a web development agency.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Website: ${params.websiteUrl || 'no website'}
${isFollowUp ? followUpContext : ''}

Problems found on their website:
${painPointsSummary || '- General website improvements needed'}

Write a ${isFollowUp ? 'follow-up' : 'cold'} email that:
- Opens with something specific about THEIR business
- Mentions 1-2 specific problems (not all of them)
- Explains the business benefit of fixing them
- Has a low-pressure CTA (curious question, not "book a call now")
- Max ${isFollowUp ? '80' : '150'} words
- Sounds like a real person wrote it, not a marketing team
- NO buzzwords: leverage, synergy, solutions, game-changer, innovative${seoNote}
- Sender: ${params.senderName || 'the team'}${sigBlock}

Respond ONLY with valid JSON:
{ "subject": "subject line", "body": "email body with \\n for line breaks" }`
  }

  const res = await client.chat.completions.create({
    model, max_tokens: 1024, temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = res.choices[0]?.message?.content || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI returned invalid email format')
  return JSON.parse(m[0]) as { subject: string; body: string }
}
