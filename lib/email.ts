import { google } from 'googleapis'
import { prisma } from './db'

function getOAuth2Client() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/auth/google/callback`,
  )
}

interface SendEmailParams {
  to: string
  subject: string
  body: string
}

/**
 * Sends via Gmail REST API using stored OAuth2 tokens.
 * More reliable than nodemailer SMTP OAuth2 — no SMTP auth errors.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected. Please connect your Google account in Settings.')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: settings.googleRefreshToken,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const fromName = settings.senderName || 'Outreach'
  const fromEmail = settings.googleEmail

  // Build RFC 2822 message
  const messageParts = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    params.body,
  ]
  const raw = Buffer.from(messageParts.join('\n')).toString('base64url')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
}

/** Verifies the stored Gmail credentials are still valid */
export async function verifyGmail(): Promise<string> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: settings.googleRefreshToken,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const profile = await gmail.users.getProfile({ userId: 'me' })

  return profile.data.emailAddress || settings.googleEmail
}
