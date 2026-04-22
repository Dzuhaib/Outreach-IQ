import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { sessionCookieOptions } from '@/lib/session'

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const msg = error === 'access_denied' ? 'You denied access to Gmail' : error || 'OAuth failed'
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`)
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/auth/google/callback`,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const email = userInfo.data.email

    if (!email) throw new Error('Could not retrieve Gmail address from Google')

    // Upsert user by Google email — each Google account is a separate user
    const user = await prisma.user.upsert({
      where: { googleEmail: email },
      update: {
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        googleEmail: email,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    // Claim any orphaned leads (created before auth was added)
    await prisma.lead.updateMany({
      where: { userId: null },
      data: { userId: user.id },
    })

    // Create a new 30-day session
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const session = await prisma.session.create({
      data: { userId: user.id, expiresAt },
    })

    const response = NextResponse.redirect(`${appUrl}/`)
    response.cookies.set(sessionCookieOptions(expiresAt).name, session.token, sessionCookieOptions(expiresAt))
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google authentication failed'
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`)
  }
}
