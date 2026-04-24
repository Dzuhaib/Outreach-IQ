'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Kanban, MailOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { href: '/opened', icon: MailOpen, label: 'Opens' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [pressing, setPressing] = useState<string | null>(null)
  // Track which tab just became active to re-trigger spring animation
  const [popKey, setPopKey] = useState<Record<string, number>>({})
  const prevActive = useRef<string>('')

  function handleNavigate(href: string) {
    if (href !== prevActive.current) {
      prevActive.current = href
      setPopKey((k) => ({ ...k, [href]: (k[href] ?? 0) + 1 }))
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none">
      <div
        className="px-3 pt-1 pointer-events-auto"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Floating card */}
        <div
          className="relative flex items-stretch rounded-[22px] overflow-hidden"
          style={{
            background: 'rgba(15,15,15,0.92)',
            backdropFilter: 'blur(28px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
            boxShadow:
              '0 -1px 0 rgba(255,255,255,0.04) inset, 0 2px 0 rgba(0,0,0,0.4) inset, 0 16px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Top shimmer highlight */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.1) 60%, transparent 100%)',
            }}
          />

          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const isPress = pressing === href
            const key = popKey[href] ?? 0

            return (
              <Link
                key={href}
                href={href}
                onPointerDown={() => setPressing(href)}
                onPointerUp={() => setPressing(null)}
                onPointerLeave={() => setPressing(null)}
                onPointerCancel={() => setPressing(null)}
                onClick={() => handleNavigate(href)}
                className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 relative select-none"
              >
                {/* Top indicator pill — slides in when active */}
                {isActive && (
                  <div
                    key={`ind-${key}`}
                    className="absolute top-0 h-[3px] w-8 rounded-full bg-accent animate-indicator-in"
                    style={{ boxShadow: '0 0 8px 1px rgba(79,110,247,0.7)' }}
                  />
                )}

                {/* Background pill — scales in when active */}
                {isActive && (
                  <div
                    key={`pill-${key}`}
                    className="absolute inset-x-1.5 inset-y-1 rounded-[16px] animate-pill-in"
                    style={{
                      background:
                        'radial-gradient(ellipse at 50% 0%, rgba(79,110,247,0.18) 0%, rgba(79,110,247,0.07) 100%)',
                      border: '1px solid rgba(79,110,247,0.15)',
                    }}
                  />
                )}

                {/* Icon + glow wrapper */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    transform: isPress
                      ? 'scale(0.80)'
                      : 'scale(1)',
                    transition: isPress
                      ? 'transform 80ms ease-out'
                      : 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {/* Spring pop on activation */}
                  <div
                    key={`icon-${key}`}
                    className={cn('relative flex items-center justify-center', isActive && key > 0 ? 'animate-nav-pop' : '')}
                  >
                    {/* Glow blob behind icon */}
                    <div
                      className="absolute rounded-full transition-all duration-500 pointer-events-none"
                      style={{
                        width: 36,
                        height: 36,
                        background: 'radial-gradient(circle, rgba(79,110,247,0.55) 0%, transparent 70%)',
                        filter: 'blur(8px)',
                        opacity: isActive ? 1 : 0,
                        transform: isActive ? 'scale(1.4)' : 'scale(0.6)',
                        transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                      }}
                    />

                    <Icon
                      className="relative w-[22px] h-[22px] transition-colors duration-300"
                      style={{ color: isActive ? '#4f6ef7' : '#555555' }}
                      strokeWidth={isActive ? 2.5 : 1.75}
                    />
                  </div>
                </div>

                {/* Label */}
                <span
                  className="relative text-[10px] font-semibold leading-none tracking-[0.03em] transition-all duration-300"
                  style={{
                    color: isActive ? '#4f6ef7' : '#3a3a3a',
                    letterSpacing: '0.03em',
                  }}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
