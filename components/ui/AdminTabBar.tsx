'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  UserCheck,
  Ellipsis,
  FileCheck2,
  Users,
  BarChart3,
  Medal,
  Download,
  Megaphone,
  ShieldAlert,
  UserCog,
  ArrowLeftRight,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

const ADMIN_TABS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/fixtures/manage', label: 'Fixtures', icon: ClipboardList },
  { href: '/admin/seasons', label: 'Seasons', icon: Trophy },
  { href: '/admin/tournament-applications', label: 'Applicants', icon: UserCheck },
] as const

const MORE_LINKS = [
  { href: '/admin/results/submit', label: 'Submit Result', icon: FileCheck2 },
  { href: '/admin/managers', label: 'Managers', icon: Users },
  { href: '/admin/polls', label: 'Polls', icon: BarChart3 },
  { href: '/admin/hall-of-fame', label: 'Hall of Fame', icon: Medal },
  { href: '/admin/export', label: 'Export', icon: Download },
  { href: '/admin/push-shooter', label: 'Send Push', icon: Megaphone },
  { href: '/admin/backdoor-submissions', label: 'Backdoor', icon: ShieldAlert },
  { href: '/admin/users/manage', label: 'Users', icon: UserCog },
] as const

interface AdminTabBarProps {
  profile?: Profile | null
}

export default function AdminTabBar({ profile }: AdminTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const supabase = createClient()

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function closeMore() {
    setMoreOpen(false)
  }

  return (
    <>
      {/* Tab bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
        <div className="relative mx-3 mb-3">
          {/* More popover (drops up) */}
          {moreOpen && (
            <div className="absolute bottom-full inset-x-0 mb-3 z-[60] rounded-2xl bg-bg-surface/95 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 shadow-[0_-8px_32px_rgba(0,0,0,0.25)] overflow-hidden animate-slide-up">
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
                    className={`flex items-center gap-space-3 w-full px-space-4 py-space-3 rounded-lg transition-colors text-sm font-medium ${
                      isActive(href)
                        ? 'text-accent bg-accent/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0 text-text-muted" />
                    <span className="flex-1">{label}</span>
                  </Link>
                ))}

                <div className="border-t border-border my-space-2" />
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-2 pt-1 pb-1">
                  Account
                </p>

                <Link
                  href="/"
                  onClick={closeMore}
                  className="flex items-center gap-space-3 w-full px-space-4 py-space-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors text-sm font-medium"
                >
                  <ArrowLeftRight className="w-5 h-5 shrink-0 text-text-muted" />
                  <span className="flex-1">Manager Mode</span>
                </Link>

                {profile && (
                  <button
                    onClick={() => { closeMore(); handleLogout() }}
                    className="flex items-center gap-space-3 w-full px-space-4 py-space-3 rounded-lg text-feedback-error hover:bg-feedback-error/10 transition-colors text-sm font-medium"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    Logout
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-around h-14 rounded-2xl bg-bg-surface/80 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] safe-area-bottom">
            {ADMIN_TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors active:scale-95 ${
                  isActive(href) ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            ))}

            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors active:scale-95 ${
                moreOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Ellipsis className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          </div>
        </div>
      </div>

      {/* Close overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={closeMore}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Spacer for tab bar height */}
      <div className="h-20 lg:hidden" />
    </>
  )
}