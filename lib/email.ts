import nodemailer from 'nodemailer'
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

async function getTransporter(): Promise<nodemailer.Transporter> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected. Please connect your Google account in Settings.')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: settings.googleRefreshToken,
    access_token: settings.googleAccessToken,
  })

  // Get a fresh access token (auto-refreshes if expired)
  const { token } = await oauth2Client.getAccessToken()

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: settings.googleEmail,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: settings.googleRefreshToken,
      accessToken: token || settings.googleAccessToken || '',
    },
  })
}

export async function sendEmail(params: {
  to: string
  subject: string
  body: string
}): Promise<void> {
  const settings = await prisma.settings.findFirst()
  const transporter = await getTransporter()

  const fromName = settings?.senderName || 'Outreach'
  const fromEmail = settings?.googleEmail || ''

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: params.body.replace(/\n/g, '<br>'),
  })
}

/** Verifies the stored Gmail credentials are still valid */
export async function verifyGmail(): Promise<string> {
  const settings = await prisma.settings.findFirst()

  if (!settings?.googleRefreshToken || !settings?.googleEmail) {
    throw new Error('Gmail not connected')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: settings.googleRefreshToken })

  await oauth2Client.getAccessToken() // throws if refresh token is revoked
  return settings.googleEmail
}
