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
  emailId: string  // used to embed the tracking pixel
}

/**
 * Sends via Gmail REST API using stored OAuth2 tokens.
 * Embeds a 1×1 tracking pixel so we know when the email is opened.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected. Please connect your Google account in Settings.')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: settings.googleRefreshToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const fromName = settings.senderName || 'Outreach'
  const fromEmail = settings.googleEmail
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Plain-text body
  const textBody = params.body

  // HTML body with tracking pixel appended
  const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333;">${
    params.body.replace(/\n/g, '<br>')
  }</div><img src="${appUrl}/api/track/open/${params.emailId}" width="1" height="1" style="display:none;border:0;" alt="" />`

  // Build a multipart/alternative MIME message so clients get text or HTML
  const boundary = `boundary_${Date.now()}`
  const messageParts = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    textBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ]

  const raw = Buffer.from(messageParts.join('\n')).toString('base64url')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

/** Verifies the stored Gmail credentials are still valid */
export async function verifyGmail(): Promise<string> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: settings.googleRefreshToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return profile.data.emailAddress || settings.googleEmail
}
