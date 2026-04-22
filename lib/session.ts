import { cookies } from 'next/headers'
import { prisma } from './db'

export async function getSessionUser() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')?.value
  if (!sid) return null

  const session = await prisma.session.findUnique({
    where: { token: sid },
    include: { user: true },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return session.user
}

/** Throws a 401-style error if not authenticated — use in API routes */
export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  return user
}

export function sessionCookieOptions(expiresAt: Date) {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    name: 'sid',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  }
}
