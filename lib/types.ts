export type LeadStatus =
  | 'NEW'
  | 'ANALYZED'
  | 'EMAIL_SENT'
  | 'FOLLOWED_UP'
  | 'REPLIED'
  | 'CONVERTED'
  | 'ARCHIVED'

export type EmailType = 'INITIAL' | 'FOLLOW_UP_3' | 'FOLLOW_UP_7'

export type AnalysisType = 'chatbot' | 'website' | 'seo'

export interface PainPoint {
  category: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

// Legacy format — kept for backward compat with existing DB records
export interface WebsiteAnalysis {
  summary: string
  painPoints: PainPoint[]
  score: number
}

// Chatbot detection result
export interface ChatbotResult {
  hasChatbot: boolean
  platform?: string
}

// Website issues result
export interface WebsiteIssue {
  category: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface WebsiteResult {
  score: number
  mobileReady: boolean
  hasSSL: boolean
  issues: WebsiteIssue[]
}

// SEO per-category analysis
export interface SEOCategory {
  score: number       // 0-100
  issues: string[]    // specific problems found
}

// SEO result — comprehensive 7-category audit
export interface SEOResult {
  score: number  // overall 0-100

  // --- Parsed directly from HTML / fetched resources ---
  hasHTTPS: boolean
  hasRobotsTxt: boolean
  robotsBlocksAll: boolean     // Disallow: / for all bots
  hasSitemap: boolean
  hasNoindex: boolean
  hasCanonical: boolean
  mobileReady: boolean
  cleanUrls: boolean

  // On-page parsed signals
  hasTitle: boolean
  titleLength: number
  title: string
  hasMetaDescription: boolean
  metaDescriptionLength: number
  metaDescription: string
  h1Count: number
  h2Count: number
  h3Count: number
  imagesWithoutAlt: number
  internalLinksCount: number
  externalLinksCount: number

  // Schema / content
  hasSchemaMarkup: boolean
  schemaTypes: string[]
  estimatedWordCount: number

  // --- AI analysis by category (from keypoints) ---
  technical: SEOCategory     // #1 Technical SEO
  onPage: SEOCategory        // #2 On-Page SEO
  content: SEOCategory       // #3 Content Quality
  backlinks: SEOCategory     // #4 Backlinks (inferred)
  trafficRankings: SEOCategory  // #5 Traffic & Rankings (inferred)
  competitorGap: SEOCategory    // #6 Competitor Gap (inferred)
  conversion: SEOCategory       // #7 Conversion / Business Impact

  // Overall
  issues: string[]    // top issues across all categories (for email gen)
  strengths: string[]

  // Contact decision
  contactRecommendation: 'yes' | 'low-priority' | 'avoid'
  contactReason: string
}

// Rich analysis — new format
export interface RichAnalysis {
  types: AnalysisType[]
  summary: string
  score: number
  painPoints: PainPoint[]
  chatbot?: ChatbotResult
  website?: WebsiteResult
  seo?: SEOResult
}

export interface EmailRecord {
  id: string
  leadId: string
  subject: string
  body: string
  type: EmailType
  sentAt: string | null
  openedAt: string | null
  openCount: number
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  businessName: string
  websiteUrl: string | null
  city: string | null
  niche: string | null
  email: string | null
  status: LeadStatus
  notes: string | null
  analysis: WebsiteAnalysis | RichAnalysis | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  emails: EmailRecord[]
}

export interface LeadListItem {
  id: string
  businessName: string
  websiteUrl: string | null
  city: string | null
  niche: string | null
  email: string | null
  status: LeadStatus
  archivedAt: string | null
  createdAt: string
  _count: { emails: number }
}

export interface Settings {
  id: string
  googleEmail: string | null
  googleAccessToken: string | null
  googleRefreshToken: string | null
  googleTokenExpiry: string | null
  openaiKey: string | null
  openaiModel: string | null
  senderName: string | null
  signature: string | null
  followUpDay3: number
  followUpDay7: number
}

export interface DashboardStats {
  totalLeads: number
  emailsSent: number
  emailsOpened: number
  openRate: number
  replied: number
  converted: number
  replyRate: number
  conversionRate: number
  byStatus: Record<LeadStatus, number>
  leadsWithOpens: number
}

export interface ApiError {
  error: string
}
