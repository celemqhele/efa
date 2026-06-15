'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalSearch from './GlobalSearch'

interface NavDesktopProps {
  profile?: any | null
  unreadCount?: number
  handleLogout: () => void
}

export default function NavDesktop({ profile, unreadCount = 0, handleLogout }: NavDesktopProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/standings', label: 'Standings' },
    { href: '/fixtures', label: 'My Fixtures' },
    { href: '/results', label: 'My Results' },
    ...(isAdmin
      ? [{ href: '/admin/calendar?scope=mine', label: 'My Calendar' }]
      : [{ href: '/calendar', label: 'Calendar' }]
    ),
    { href: '/hall-of-fame', label: 'Hall of Fame' },
    { href: '/rules', label: 'Rules' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-text-primary text-sm">
              Efootball Federal Association
            </span>
          </Link>

          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {profile ? (
              <>
                <GlobalSearch />

                <Link
                  href="/notifications"
                  className="relative p-2 rounded-md text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-bg-base text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-1 px-3 py-1 bg-accent-muted border border-accent/30 text-accent rounded-md text-xs font-medium hover:bg-accent/20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Admin
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-elevated transition-colors"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-contain bg-bg-elevated" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center">
                      <span className="text-accent text-xs font-bold">
                        {profile.username?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-text-secondary">{profile.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="text-xs text-text-muted hover:text-feedback-error transition-colors px-2 py-1"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-xs text-text-muted hover:text-text-primary transition-colors px-3 py-1">
                  Login
                </Link>
                <Link href="/register" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-accent text-bg-base hover:bg-accent/90 transition-colors">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
