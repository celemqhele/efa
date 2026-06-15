'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalSearch from './GlobalSearch'

interface NavMobileProps {
  profile?: any | null
  unreadCount?: number
  handleLogout: () => void
}

export default function NavMobile({ profile, unreadCount = 0, handleLogout }: NavMobileProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-12 px-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/efa-logo-white.png"
            alt="EFA"
            width={24}
            height={24}
            className="w-6 h-6 object-contain"
          />
          <span className="font-bold text-text-primary text-sm">EFA</span>
        </Link>

        <div className="flex items-center gap-1">
          {profile && <GlobalSearch />}

          {profile && (
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
          )}

          {profile && (
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
            </Link>
          )}

          {!profile && (
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
    </nav>
  )
}
