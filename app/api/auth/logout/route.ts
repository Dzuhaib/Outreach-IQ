import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const cookieStore = await cookies()
    const sid = cookieStore.get('sid')?.value

    if (sid) {
      await prisma.session.deleteMany({ where: { token: sid } }).catch(() => {})
    }

    const response = NextResponse.redirect(`${appUrl}/login`)
    response.cookies.set('sid', '', { maxAge: 0, path: '/' })
    return response
  } catch {
    const response = NextResponse.redirect(`${appUrl}/login`)
    response.cookies.set('sid', '', { maxAge: 0, path: '/' })
    return response
  }
}
