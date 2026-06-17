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
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden lg:block">
        <nav className="flex items-center gap-2 bg-bg-surface/80 backdrop-saturate-150 backdrop-blur-2xl rounded-2xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-border/50">
          <Link href="/" className="flex items-center gap-2 shrink-0 pr-3 border-r border-border/40">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={22}
              height={22}
              className="w-5.5 h-5.5 object-contain"
            />
          </Link>

          <div className="flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.href.split('?')[0], pathname)
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
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

          {profile ? (
            <div className="flex items-center gap-0.5 pl-3 border-l border-border/40">
              <GlobalSearch />

              <Link
                href="/notifications"
                className="relative p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-accent text-bg-base text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </Link>
              )}

              <Link
                href="/profile"
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-bg-elevated/80 transition-colors"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover bg-bg-elevated ring-1 ring-border-subtle" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center ring-1 ring-accent/20">
                    <span className="text-accent text-[10px] font-bold">
                      {profile.username?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-text-muted hover:text-feedback-error hover:bg-feedback-error/5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-3 border-l border-border/40">
              <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 rounded-xl hover:bg-bg-elevated/80">
                Log in
              </Link>
              <Link href="/register" className="text-sm font-bold px-3.5 py-1.5 rounded-xl bg-accent text-bg-base hover:bg-accent/90 transition-colors shadow-sm">
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>

      <div className="hidden lg:block h-24" />
    </>
  )
}
