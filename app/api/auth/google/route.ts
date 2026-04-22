import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?error=${encodeURIComponent(
        'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local'
      )}`
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/auth/google/callback`,
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',   // required to get a refresh token
    prompt: 'consent',         // always show consent so we always receive a refresh token
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  })

  return NextResponse.redirect(authUrl)
}
