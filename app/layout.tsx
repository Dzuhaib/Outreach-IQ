import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: { default: 'OutreachIQ', template: '%s | OutreachIQ' },
  description: 'AI-powered lead management and cold outreach system',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isAuthenticated = !!cookieStore.get('sid')?.value

  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="bg-bg text-text-1 font-sans flex h-screen overflow-hidden">
        {isAuthenticated && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
