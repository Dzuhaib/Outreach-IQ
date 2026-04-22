import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'

const SETTINGS_ID = 'singleton'

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const msg = error === 'access_denied' ? 'You denied access to Gmail' : error || 'OAuth failed'
    return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent(msg)}`)
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/auth/google/callback`,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Fetch the user's Gmail address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const email = userInfo.data.email

    if (!email) throw new Error('Could not retrieve Gmail address from Google')

    await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        googleEmail: email,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        id: SETTINGS_ID,
        googleEmail: email,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    return NextResponse.redirect(`${appUrl}/settings?connected=gmail`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google authentication failed'
    return NextResponse.redirect(`${appUrl}/settings?error=${encodeURIComponent(msg)}`)
  }
}
