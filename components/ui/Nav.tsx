'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import ThemeToggle from './ThemeToggle'

interface NavProps {
  profile?: Profile | null
  unreadCount?: number
}

export default function Nav({ profile, unreadCount = 0 }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
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
    { href: '/calendar', label: 'Calendar' },
    { href: '/hall-of-fame', label: 'Hall of Fame' },
    { href: '/rules', label: 'Rules' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center">
              <span className="text-[#0a1128] font-black text-xs">EFA</span>
            </div>
            <span className="font-bold text-slate-900 hidden sm:block text-sm">
              Efootball Federal Association
            </span>
            <span className="font-bold text-slate-900 sm:hidden text-sm">EFA</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                    : 'text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/10 dark:hover:text-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {profile ? (
              <>
                {/* Notifications bell */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/10 dark:hover:text-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#c9a84c] text-[#0a1128] text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c]/20 border border-[#c9a84c]/30 text-[#c9a84c] rounded-lg text-xs font-medium hover:bg-[#c9a84c]/30 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Admin
                  </Link>
                )}

                {/* Profile */}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-contain bg-navy-light" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-[#c9a84c] text-xs font-bold">
                        {profile.username[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="hidden md:block text-xs font-medium text-slate-700">{profile.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden md:block text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1.5"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-xs text-slate-400 hover:text-slate-900 transition-colors px-3 py-1.5">
                  Login
                </Link>
                <Link href="/register" className="btn-gold text-xs px-3 py-1.5">
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/10 dark:hover:text-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-slate-200 py-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                      : 'text-slate-400 hover:text-slate-900 hover:bg-black/5 dark:hover:bg-white/10 dark:hover:text-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors col-span-2"
                >
                  Admin Dashboard
                </Link>
              )}
            </div>
            {profile && (
              <button
                onClick={() => { handleLogout(); setMenuOpen(false) }}
                className="w-full mt-2 text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
