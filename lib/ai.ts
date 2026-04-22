import OpenAI from 'openai'
import { prisma } from './db'
import { stripHtml, DEFAULT_OPENAI_MODEL } from './utils'
import type {
  WebsiteAnalysis, RichAnalysis, AnalysisType,
  ChatbotResult, WebsiteResult, SEOResult, PainPoint,
} from './types'

async function getClient(userId: string): Promise<{ client: OpenAI; model: string }> {
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null
  const apiKey = user?.openaiKey || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured. Please add it in Settings.')
  const model = user?.openaiModel || DEFAULT_OPENAI_MODEL
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

async function fetchTextSafe(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' } })
    return r.ok ? await r.text() : ''
  } catch { return '' } finally { clearTimeout(t) }
}

async function analyzeSEO(
  html: string,
  url: string,
  businessName: string,
  client: OpenAI,
  model: string,
): Promise<SEOResult> {
  // ── 1. Derive base URL ────────────────────────────────────────────────────
  let origin = ''
  try { origin = new URL(url).origin } catch { origin = '' }

  // ── 2. Fetch robots.txt + sitemap in parallel (non-blocking) ─────────────
  const [robotsTxt, sitemapXml] = await Promise.all([
    origin ? fetchTextSafe(`${origin}/robots.txt`) : Promise.resolve(''),
    origin ? fetchTextSafe(`${origin}/sitemap.xml`) : Promise.resolve(''),
  ])

  const hasRobotsTxt = robotsTxt.length > 0
  // Detect blanket Disallow: / targeting * or Googlebot
  const robotsBlocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?:\s|$)/i.test(robotsTxt) ||
    /User-agent:\s*Googlebot[\s\S]*?Disallow:\s*\/(?:\s|$)/i.test(robotsTxt)
  // Sitemap found in robots.txt OR as /sitemap.xml
  const hasSitemap = /^Sitemap:/im.test(robotsTxt) ||
    sitemapXml.includes('<?xml') || sitemapXml.includes('<urlset') || sitemapXml.includes('<sitemapindex')

  // ── 3. Parse HTML signals ─────────────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || ''

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  const metaDescription = metaDescMatch?.[1]?.trim() || ''

  // noindex detection
  const hasNoindex =
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html) ||
    /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(html)

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length
  const hasCanonical = /rel=["']canonical["']/i.test(html)
  const mobileReady = /viewport.*width=device-width/i.test(html)
  const hasHTTPS = url.startsWith('https://')

  const hasSchema = html.includes('application/ld+json')
  const schemaTypeMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || []
  const schemaTypes = [
    ...new Set(schemaTypeMatches.map((m) => m.replace(/"@type"\s*:\s*"/, '').replace(/"$/, ''))),
  ]

  const imgTags = html.match(/<img[^>]*>/gi) || []
  const imagesWithoutAlt = imgTags.filter((img) => !/alt=["'][^"']+["']/i.test(img)).length

  // Internal vs external links
  const allLinks = html.match(/href=["']([^"'#?]+)["']/gi) || []
  let internalLinksCount = 0
  let externalLinksCount = 0
  for (const link of allLinks) {
    const href = link.replace(/href=["']/, '').replace(/["']$/, '')
    if (href.startsWith('/') || (origin && href.startsWith(origin))) internalLinksCount++
    else if (href.startsWith('http')) externalLinksCount++
  }

  // URL structure quality — penalise params, .html extensions, very deep paths
  const urlPath = (() => { try { return new URL(url).pathname } catch { return '' } })()
  const cleanUrls = !url.includes('?') && !urlPath.endsWith('.html') && !urlPath.endsWith('.php') &&
    (urlPath.split('/').filter(Boolean).length <= 4)

  const textContent = stripHtml(html)
  const estimatedWordCount = textContent.split(/\s+/).filter((w) => w.length > 2).length

  // ── 4. AI comprehensive analysis ─────────────────────────────────────────
  const prompt = `You are an expert SEO consultant auditing a small business website for a cold outreach agency.
Your analysis will be used to decide whether to pitch this business as an SEO client and to craft a targeted email.

Business: ${businessName}
URL: ${url}
Industry / niche: inferred from content below

=== PRE-PARSED TECHNICAL SIGNALS ===
HTTPS: ${hasHTTPS ? 'yes' : 'NO — missing'}
robots.txt: ${hasRobotsTxt ? 'present' : 'missing'}
Blanket crawl block in robots.txt: ${robotsBlocksAll ? 'YES — Google is blocked!' : 'no'}
XML sitemap: ${hasSitemap ? 'found' : 'NOT FOUND'}
noindex meta tag: ${hasNoindex ? 'YES — page blocked from indexing!' : 'no'}
Canonical tag: ${hasCanonical ? 'present' : 'missing'}
Mobile viewport: ${mobileReady ? 'yes' : 'NO — not mobile-ready'}
Clean URL structure: ${cleanUrls ? 'yes' : 'issues detected'}
Title: "${title}" (${title.length} chars, ideal 50-60)
Meta description: "${metaDescription ? metaDescription.slice(0, 120) : 'MISSING'}" (${metaDescription.length} chars, ideal 150-160)
H1: ${h1Count} (ideal = 1), H2: ${h2Count}, H3: ${h3Count}
JSON-LD schema markup: ${hasSchema ? `yes — ${schemaTypes.slice(0, 5).join(', ') || 'types unknown'}` : 'MISSING'}
Images missing alt text: ${imagesWithoutAlt} of ${imgTags.length}
Internal links on page: ${internalLinksCount}
External links on page: ${externalLinksCount}
Estimated word count: ${estimatedWordCount} (thin = <300, good = 800+)

=== PAGE CONTENT SAMPLE ===
${textContent.slice(0, 3000)}

=== YOUR TASK ===
Analyse across ALL 7 SEO dimensions. For each, give a score (0-100) and 1-3 specific, actionable issues.
Base backlinks/traffic/rankings on indirect signals you can observe (content quality, domain structure, schema, technical health, niche competition level).

Respond ONLY with valid JSON matching this exact structure (no extra keys, no markdown):
{
  "overall_score": 42,
  "technical":        { "score": 55, "issues": ["robots.txt is missing", "no XML sitemap found"] },
  "on_page":          { "score": 40, "issues": ["title tag missing target keyword", "H1 duplicates page title without variation"] },
  "content":          { "score": 35, "issues": ["~180 words is too thin for competitive ranking", "no blog or resource section for topic clustering"] },
  "backlinks":        { "score": 30, "issues": ["no outbound links to authority sites signals low trust", "no schema markup reduces chance of rich snippet citations"] },
  "traffic_rankings": { "score": 25, "issues": ["thin content unlikely to rank beyond branded queries", "no long-tail keyword targeting visible in headings"] },
  "competitor_gap":   { "score": 40, "issues": ["competitors in this niche typically have 3-5x more content", "local SEO signals (NAP, LocalBusiness schema) absent"] },
  "conversion":       { "score": 50, "issues": ["primary CTA not visible above the fold", "no trust signals near conversion points"] },
  "strengths": ["HTTPS enabled", "mobile viewport present"],
  "contact_recommendation": "yes",
  "contact_reason": "Ranking signals are weak, thin content, missing technical basics — high opportunity for improvement"
}

contact_recommendation values:
- "yes" — clear SEO gaps, opportunity to win the project (page 2-3 ranking signals, weak content, technical issues, competitors beating them)
- "low-priority" — some issues but already decent; might be hard to sell
- "avoid" — already highly optimised, or domain appears inactive/spammy/no business intent`

  const res = await client.chat.completions.create({
    model, max_tokens: 1400, temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })
  const aiText = res.choices[0]?.message?.content || ''
  const m = aiText.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Invalid SEO analysis response')
  const ai = JSON.parse(m[0])

  // Flatten top issues for email generation (non-SEO-only path)
  const allIssues: string[] = [
    ...(ai.technical?.issues || []),
    ...(ai.on_page?.issues || []),
    ...(ai.content?.issues || []),
  ].slice(0, 5)

  const def = (o: { score?: number; issues?: string[] } | undefined) => ({
    score: o?.score ?? 40,
    issues: o?.issues || [],
  })

  return {
    score: ai.overall_score ?? 40,

    hasHTTPS,
    hasRobotsTxt,
    robotsBlocksAll,
    hasSitemap,
    hasNoindex,
    hasCanonical,
    mobileReady,
    cleanUrls,

    hasTitle: !!title,
    titleLength: title.length,
    title,
    hasMetaDescription: !!metaDescription,
    metaDescriptionLength: metaDescription.length,
    metaDescription,
    h1Count,
    h2Count,
    h3Count,
    imagesWithoutAlt,
    internalLinksCount,
    externalLinksCount,

    hasSchemaMarkup: hasSchema,
    schemaTypes,
    estimatedWordCount,

    technical:        def(ai.technical),
    onPage:           def(ai.on_page),
    content:          def(ai.content),
    backlinks:        def(ai.backlinks),
    trafficRankings:  def(ai.traffic_rankings),
    competitorGap:    def(ai.competitor_gap),
    conversion:       def(ai.conversion),

    issues: allIssues,
    strengths: ai.strengths || [],
    contactRecommendation: ai.contact_recommendation ?? 'low-priority',
    contactReason: ai.contact_reason ?? '',
  }
}

export async function analyzeWebsite(
  url: string,
  businessName: string,
  types: AnalysisType[] = ['chatbot', 'website', 'seo'],
  userId?: string,
): Promise<RichAnalysis> {
  const { client, model } = await getClient(userId || '')

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
      const empty = { score: 0, issues: [] }
      seo = {
        score: 40,
        hasHTTPS: url.startsWith('https://'), hasRobotsTxt: false, robotsBlocksAll: false,
        hasSitemap: false, hasNoindex: false, hasCanonical: false, mobileReady: false, cleanUrls: false,
        hasTitle: false, titleLength: 0, title: '', hasMetaDescription: false,
        metaDescriptionLength: 0, metaDescription: '', h1Count: 0, h2Count: 0, h3Count: 0,
        imagesWithoutAlt: 0, internalLinksCount: 0, externalLinksCount: 0,
        hasSchemaMarkup: false, schemaTypes: [], estimatedWordCount: 0,
        technical: empty, onPage: empty, content: empty, backlinks: empty,
        trafficRankings: empty, competitorGap: empty, conversion: empty,
        issues: [], strengths: [], contactRecommendation: 'low-priority', contactReason: '',
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
  userId?: string
}): Promise<{ subject: string; body: string }> {
  const { client, model } = await getClient(params.userId || '')

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
    const contactRec = seo.contactRecommendation ?? 'yes'
    const contactReason = seo.contactReason || ''

    // SEO-only mode: proposal to win/beat their team — NEVER list technical problems
    prompt = `You are writing a cold outreach email for an SEO agency pitching to a small business.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Website: ${params.websiteUrl || 'unknown'}
Their SEO health score: ${seo.score}/100
Contact recommendation: ${contactRec}
Why this is a good prospect: ${contactReason}
${isFollowUp ? followUpContext : ''}

STRICT RULES — read carefully:
- Do NOT list their specific SEO problems, missing tags, broken signals, or technical issues — they will fix it themselves and not need us
- Do NOT say things like "your website is missing X" or "your site has Y problem"
- DO position our agency as experts who can OUTPERFORM their current SEO situation or competitors
- DO focus on OUTCOMES: more leads from Google, beating competitors in search, growing non-branded traffic
- DO imply you spotted a competitive gap or opportunity — be vague about the specifics
- Frame it as: "we found an opportunity in your market" NOT "we found problems on your site"
- If their score is low (${seo.score < 40 ? 'it is — ' + seo.score + '/100' : 'consider their competitive position'}), the opportunity for growth is large — make that compelling
- Use a low-pressure CTA — a curious question like "would it be worth a quick look?"
- Max ${isFollowUp ? '70' : '130'} words
- Conversational and confident — not desperate or salesy
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
