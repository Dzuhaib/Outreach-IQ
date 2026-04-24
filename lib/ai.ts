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
      category: 'AI Chatbot',
      description: 'No AI Chatbot detected. Visitors have no instant contact option, meaning potential leads are lost when no one is available to respond.',
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
  openCount?: number
  senderName: string | null
  signature: string | null
  userId?: string
}): Promise<{ subject: string; body: string }> {
  const { client, model } = await getClient(params.userId || '')

  const isFollowUp = params.type !== 'INITIAL'
  const isFinalFollowUp = params.type === 'FOLLOW_UP_7'
  const openCount = params.openCount ?? 0
  const rich = 'types' in params.analysis ? (params.analysis as RichAnalysis) : null
  const sigBlock = params.signature ? `\nSignature to include:\n${params.signature}` : ''

  // ── Service names (used in both initial and follow-up prompts) ──────────────
  const analyzedTypes: AnalysisType[] = rich?.types || []
  const serviceNames = analyzedTypes.length > 0
    ? analyzedTypes.map((t) =>
        t === 'chatbot' ? 'AI Chatbot (24/7 Lead Generation)'
        : t === 'website' ? 'Website Optimization'
        : 'SEO'
      ).join(', ')
    : 'Website Improvements'

  // ══════════════════════════════════════════════════════════════════════════════
  // FOLLOW-UP PATH — open-count-aware, short, personal, not a re-pitch
  // ══════════════════════════════════════════════════════════════════════════════
  if (isFollowUp) {
    let engagementContext: string
    let bodyInstruction: string

    if (openCount === 0) {
      engagementContext = `The prospect has NOT opened the previous email. They may have missed it completely.`
      bodyInstruction = `Gently remind them about your previous email. Re-state the core value in one sentence. Keep the tone light — no pressure. End with a soft question like whether they had a chance to take a look.`
    } else if (openCount === 1) {
      engagementContext = `The prospect opened the previous email exactly once but did not reply.`
      bodyInstruction = `Acknowledge naturally that they had a chance to read through your last email. Write something along these lines: you saw they had a look at what you shared about ${serviceNames}, and you wanted to check in — maybe they have a question or something they are not sure about, and you are happy to clear anything up. Keep it warm, genuine and inviting. No pressure.`
    } else {
      engagementContext = `The prospect opened the previous email ${openCount} times without replying. This is a clear signal of strong interest — they keep coming back to it but something is holding them back, likely questions or uncertainty.`
      bodyInstruction = `Write with confidence. Acknowledge that they have been reading through your last email more than once — they are clearly thinking about it. Write something along these lines: you noticed they have gone back to your email a few times, which tells you they are interested, and you think they might have some questions or want to understand more — so why not get on a quick call and talk through it properly. Be warm and direct, not pushy.`
    }

    const prompt = `You are a senior copywriter writing a ${isFinalFollowUp ? 'final' : 'first'} follow-up cold email for a digital agency.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Services pitched in previous email: ${serviceNames}
${isFinalFollowUp ? 'IMPORTANT: This is the FINAL follow-up. Keep it very short. Graceful last attempt. Leave the door open for the future.' : ''}

=== EMAIL ENGAGEMENT DATA ===
${engagementContext}

=== HOW TO WRITE THE BODY ===
${bodyInstruction}

=== WRITING RULES — follow every single one ===

SUBJECT LINE:
- Must feel like a genuine, human follow-up — not a fresh marketing pitch
- Use curiosity or a soft, confident hook that fits a follow-up context
- Keep it under 9 words
- No dashes or special characters
- Good follow-up subject tones (do not copy verbatim): "Still thinking it over?", "Did you get a chance to look?", "Had a chance to read this?", "Quick thought on my last email", "You opened this a few times..."

EMAIL BODY:
- Maximum ${isFinalFollowUp ? '60' : '80'} words
- Must feel like a real person checking in — not an automated email sequence
- Reference the previous email naturally, without saying "as per my last email"
- Address the engagement signal (from the context above) in a natural, non-creepy way — it should feel observant, not surveillance-like
- End with exactly one soft, direct question as the CTA
- Short paragraphs only — no bullet points, no numbered lists
- ABSOLUTELY NO dashes of any kind (no em dash, no en dash, no hyphen used as a separator) anywhere in the body or subject
- No buzzwords: leverage, synergy, game-changer, innovative, cutting-edge, solutions, empower
- Warm but confident tone — like a colleague following up, not a salesperson chasing
- Sender name: ${params.senderName || 'the team'}${sigBlock}

Respond ONLY with valid JSON — no markdown, no explanation:
{ "subject": "subject line here", "body": "email body here with \\n for paragraph breaks" }`

    const res = await client.chat.completions.create({
      model, max_tokens: 600, temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.choices[0]?.message?.content || ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('AI returned invalid email format')
    return JSON.parse(m[0]) as { subject: string; body: string }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // INITIAL EMAIL PATH — full service-aware pitch
  // ══════════════════════════════════════════════════════════════════════════════

  const serviceContextParts: string[] = []

  if (analyzedTypes.includes('chatbot') && rich?.chatbot) {
    const { hasChatbot, platform } = rich.chatbot
    serviceContextParts.push(
      hasChatbot
        ? `AI CHATBOT: They already have a chat widget (${platform}). Pitch upgrading to a full AI Chatbot that works 24/7 for lead generation and automated qualification — their current tool is passive, ours is proactive.`
        : `AI CHATBOT: No chatbot detected on their site. They are losing potential leads every hour they are offline. Pitch: an AI Chatbot that works 24/7 for lead generation — it captures and qualifies visitors automatically, even at 3am.`
    )
  }

  if (analyzedTypes.includes('website') && rich?.website) {
    const topIssues = rich.website.issues
      .filter((i) => i.severity !== 'low')
      .slice(0, 2)
      .map((i) => i.description)
      .join('; ') || 'performance and design improvements needed'
    serviceContextParts.push(
      `WEBSITE OPTIMIZATION: Score ${rich.website.score}/100. Issues found: ${topIssues}. Pitch the benefits: faster load speed, modern trustworthy design, better user experience that converts visitors into customers.`
    )
  }

  if (analyzedTypes.includes('seo') && rich?.seo) {
    const seo = rich.seo
    serviceContextParts.push(
      `SEO: Score ${seo.score}/100. Opportunity: ${seo.contactReason || 'competitive gap in their market'}. Pitch the benefits: more traffic from Google, outranking competitors, growing leads without paid ads. Do NOT reveal specific technical problems — frame it as a growth opportunity only.`
    )
  }

  if (!rich) {
    const legacyAnalysis = params.analysis as WebsiteAnalysis
    const painPoints = legacyAnalysis.painPoints
      .filter((p) => p.severity !== 'low')
      .slice(0, 3)
      .map((p) => `${p.category}: ${p.description}`)
      .join('; ') || 'general website improvements needed'
    serviceContextParts.push(`WEBSITE: ${painPoints}`)
  }

  const prompt = `You are a senior copywriter writing a cold outreach email for a digital agency. You have analyzed the prospect's website and found clear opportunities.

Business: ${params.businessName}
City: ${params.city || 'unknown'}
Industry: ${params.niche || 'unknown'}
Website: ${params.websiteUrl || 'no website'}
Services we are pitching (based on analysis): ${serviceNames}

=== SERVICES ANALYZED AND CONTEXT ===
${serviceContextParts.join('\n\n')}

=== WRITING RULES — follow every single one ===

SUBJECT LINE:
- Must be highly compelling and curiosity-driven — the kind that makes someone stop scrolling and open the email
- Use psychological triggers: FOMO, curiosity, specificity to their business or industry
- Keep it under 9 words
- No clickbait spam words (free, guaranteed, limited time)
- No dashes or special characters

EMAIL BODY:
- Open with a confident, specific observation about their business or industry — not a generic compliment
- Dedicate 1 to 2 sentences to EACH service listed in "${serviceNames}" — cover all of them, in order
- For each service, focus entirely on the BUSINESS BENEFIT to them, not the technical detail
- For AI Chatbot: ALWAYS write "AI Chatbot that works 24/7 for lead generation" — NEVER write "live chat", "chat widget", or "chat system"
- For SEO: frame as a growth and competitive opportunity — NEVER reveal specific technical problems
- End with one soft CTA — a genuine, curious question (not "book a call", not "schedule a demo")
- Maximum 150 words for the entire body
- Write in short, flowing paragraphs — no bullet points, no numbered lists
- ABSOLUTELY NO dashes of any kind (no em dash, no en dash, no hyphen used as a separator) anywhere in the subject or body
- No buzzwords: leverage, synergy, game-changer, innovative, cutting-edge, solutions, empower
- Sound like a real person — confident and direct, not a marketing robot
- Sender name: ${params.senderName || 'the team'}${sigBlock}

Respond ONLY with valid JSON — no markdown, no explanation:
{ "subject": "subject line here", "body": "email body here with \\n for paragraph breaks" }`

  const res = await client.chat.completions.create({
    model, max_tokens: 1024, temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = res.choices[0]?.message?.content || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI returned invalid email format')
  return JSON.parse(m[0]) as { subject: string; body: string }
}
