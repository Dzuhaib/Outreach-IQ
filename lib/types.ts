export type LeadStatus =
  | 'NEW'
  | 'ANALYZED'
  | 'EMAIL_SENT'
  | 'FOLLOWED_UP'
  | 'REPLIED'
  | 'CONVERTED'
  | 'ARCHIVED'

export type EmailType = 'INITIAL' | 'FOLLOW_UP_3' | 'FOLLOW_UP_7'

export interface PainPoint {
  category: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface WebsiteAnalysis {
  summary: string
  painPoints: PainPoint[]
  score: number
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
  analysis: WebsiteAnalysis | null
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
}

export interface ApiError {
  error: string
}
