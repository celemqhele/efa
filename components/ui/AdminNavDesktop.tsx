'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NewsTopicExportButton from '@/app/(admin)/admin/dashboard/NewsTopicExportButton'
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  UserCheck,
  UserCog,
  Ellipsis,
  FileCheck2,
  BarChart3,
  Medal,
  Download,
  Megaphone,
  ShieldAlert,
  ArrowLeftRight,
  LogOut,
} from 'lucide-react'

const ADMIN_TABS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/fixtures/manage', label: 'Fixtures', icon: ClipboardList },
  { href: '/admin/seasons', label: 'Seasons', icon: Trophy },
  { href: '/admin/tournament-applications', label: 'Applicants', icon: UserCheck },
  { href: '/admin/users/manage', label: 'Users', icon: UserCog },
] as const

const MORE_LINKS = [
  { href: '/admin/results/submit', label: 'Submit Result', icon: FileCheck2 },
  { href: '/admin/polls', label: 'Polls', icon: BarChart3 },
  { href: '/admin/hall-of-fame', label: 'Hall of Fame', icon: Medal },
  { href: '/admin/export', label: 'Export', icon: Download },
  { href: '/admin/push-shooter', label: 'Send Push', icon: Megaphone },
  { href: '/admin/backdoor-submissions', label: 'Backdoor', icon: ShieldAlert },
] as const

interface AdminNavDesktopProps {
  profile?: any | null
  handleLogout: () => void
}

function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AdminNavDesktop({ profile, handleLogout }: AdminNavDesktopProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  function closeMore() {
    setMoreOpen(false)
  }

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
            {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
              const isActive = isActiveLink(href, pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accent text-bg-base shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              )
            })}

            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                moreOpen ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80'
              }`}
            >
              <Ellipsis className="w-3.5 h-3.5" />
              More
            </button>
          </div>

          <div className="flex items-center gap-0.5 pl-3 border-l border-border/40">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Manager Mode
            </Link>

            {profile ? (
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
            ) : null}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-text-muted hover:text-feedback-error hover:bg-feedback-error/5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[60] rounded-2xl bg-bg-surface/95 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 shadow-[0_-8px_32px_rgba(0,0,0,0.25)] overflow-hidden animate-slide-up w-64">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            <div className="px-3 pb-3 max-h-[55vh] overflow-y-auto">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-2 pt-1 pb-1">
                Admin
              </p>
              {MORE_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMore}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                    isActiveLink(href, pathname)
                      ? 'text-accent bg-accent/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0 text-text-muted" />
                  <span className="flex-1">{label}</span>
                </Link>
              ))}
              <NewsTopicExportButton />
            </div>
          </div>
        )}
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-40 hidden lg:block" onClick={closeMore}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      <div className="hidden lg:block h-24" />
    </>
  )
}
