'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalSearch from './GlobalSearch'
import { useState } from 'react'

interface NavMobileProps {
  profile?: any | null
  unreadCount?: number
  handleLogout: () => void
}

export default function NavMobile({ profile, unreadCount = 0, handleLogout }: NavMobileProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/standings', label: 'Standings' },
    { href: '/fixtures', label: 'My Fixtures' },
    { href: '/results', label: 'My Results' },
    ...(isAdmin
      ? [{ href: '/admin/calendar?scope=mine', label: 'My Calendar' }]
      : [{ href: '/calendar', label: 'Calendar' }]
    ),

  ]

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-12 px-4">
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

          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-bg-surface z-50 border-l border-border shadow-xl transform transition-transform duration-200 ease-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-12 px-4 border-b border-border">
          <span className="text-sm font-bold text-text-primary">Menu</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-md text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {profile && (
          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-4 border-b border-border/50 hover:bg-bg-elevated/50 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-contain bg-bg-elevated" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-border-subtle flex items-center justify-center">
                <span className="text-accent text-base font-bold">{profile.username?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{profile.username}</p>
              <p className="text-xs text-text-muted truncate">{profile.email}</p>
            </div>
          </Link>
        )}

        <div className="py-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent border-r-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50'
                }`}
              >
                <span>{link.label}</span>
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              href="/admin/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-accent hover:bg-accent/10 transition-colors border-t border-border/50 mt-2 pt-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Admin Panel
            </Link>
          )}
        </div>

        {profile && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
            <button
              onClick={() => {
                setMenuOpen(false)
                handleLogout()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-feedback-error hover:bg-feedback-error/10 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
