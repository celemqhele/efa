'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import { Button } from './Button'

interface NavProps {
  profile?: Profile | null
  unreadCount?: number
}

export default function Nav({ profile, unreadCount = 0 }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
      <div className="max-w-7xl mx-auto px-space-4">
        <div className="flex items-center justify-between h-space-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-space-2 shrink-0">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-text-primary hidden sm:block text-sm">
              Efootball Federal Association
            </span>
            <span className="font-bold text-text-primary sm:hidden text-sm">EFA</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-space-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-space-3 py-space-1 rounded-md text-xs font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated dark:hover:bg-bg-elevated dark:hover:text-text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-space-1">
            {profile ? (
              <>
                {/* Notifications bell */}
                <Link
                  href="/notifications"
                  className="relative p-space-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated dark:hover:bg-bg-elevated dark:hover:text-text-primary transition-colors"
                >
                  <svg className="w-space-5 h-space-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-space-4 h-space-4 bg-accent text-bg-base text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="hidden lg:flex items-center gap-space-1 px-space-3 py-space-1 bg-accent-muted border border-accent/30 text-accent rounded-md text-xs font-medium hover:bg-accent/20 transition-colors"
                  >
                    <svg className="w-space-3 h-space-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Admin
                  </Link>
                )}

                {/* Profile */}
                <Link
                  href="/profile"
                  className="flex items-center gap-space-2 px-space-2 py-space-1 rounded-md hover:bg-bg-elevated dark:hover:bg-bg-elevated transition-colors"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-space-7 h-space-7 rounded-full object-contain bg-bg-elevated" />
                  ) : (
                    <div className="w-space-7 h-space-7 rounded-full bg-border-subtle flex items-center justify-center">
                      <span className="text-accent text-xs font-bold">
                        {profile.username[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="hidden lg:block text-xs font-medium text-text-secondary">{profile.username}</span>
                </Link>

                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="hidden lg:block text-xs text-text-muted hover:text-feedback-error transition-colors px-space-2 py-space-1"
                >
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-space-2">
                <Link href="/login" className="text-xs text-text-muted hover:text-text-primary transition-colors px-space-3 py-space-1">
                  Login
                </Link>
                <Button variant="primary" className="text-xs px-space-3 py-space-1">
                  Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

