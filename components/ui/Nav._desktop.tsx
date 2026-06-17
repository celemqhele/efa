'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BarChart3, CalendarDays, ListChecks, Calendar, LayoutDashboard, Bell, LogOut } from 'lucide-react'
import GlobalSearch from './GlobalSearch'

interface NavDesktopProps {
  profile?: any | null
  unreadCount?: number
  handleLogout: () => void
}

function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/admin/calendar') return pathname.startsWith('/admin/calendar')
  return pathname === href || pathname.startsWith(href + '/')
}

function getNavLinks(isAdmin: boolean): { href: string; label: string; icon: any }[] {
  const links = [
    { href: '/', label: 'Home', icon: House },
    { href: '/standings', label: 'Standings', icon: BarChart3 },
    { href: '/fixtures', label: 'Fixtures', icon: CalendarDays },
    { href: '/results', label: 'Results', icon: ListChecks },
    ...(isAdmin
      ? [{ href: '/admin/calendar?scope=mine', label: 'Calendar', icon: Calendar }]
      : [{ href: '/calendar', label: 'Calendar', icon: Calendar }]
    ),

  ]
  return links
}

export default function NavDesktop({ profile, unreadCount = 0, handleLogout }: NavDesktopProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const navLinks = getNavLinks(isAdmin)

  return (
    <nav className="sticky top-0 z-50 bg-bg-surface/70 backdrop-saturate-150 backdrop-blur-2xl shadow-[0_0.5px_1px_rgba(0,0,0,0.1)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={24}
              height={24}
              className="w-6 h-6 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-bold text-text-primary text-sm leading-tight hidden sm:inline">
              EFA
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-0.5 bg-bg-elevated/50 rounded-2xl p-1">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.href.split('?')[0], pathname)
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accent text-bg-base shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            {profile ? (
              <>
                <GlobalSearch />

                <Link
                  href="/notifications"
                  className="relative p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 transition-colors"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-bg-base text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Admin</span>
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-bg-elevated/80 transition-colors"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover bg-bg-elevated ring-1 ring-border-subtle" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center ring-1 ring-accent/20">
                      <span className="text-accent text-xs font-bold">
                        {profile.username?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-text-secondary hidden xl:inline">{profile.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-feedback-error transition-colors px-2.5 py-1.5 rounded-xl hover:bg-feedback-error/5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 rounded-xl hover:bg-bg-elevated/80">
                  Log in
                </Link>
                <Link href="/register" className="text-sm font-bold px-4 py-1.5 rounded-xl bg-accent text-bg-base hover:bg-accent/90 transition-colors shadow-sm">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
