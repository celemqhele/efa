'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  House,
  Trophy,
  Calendar,
  ClipboardList,
  Ellipsis,
  User,
  ScrollText,
  Award,
  Shield,
  LogOut,
  Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/supabase/types'
import AdminTabBar from './AdminTabBar'

interface BottomTabBarProps {
  profile?: Profile | null
  unreadCount?: number
}

const TABS = [
  { href: '/', label: 'Home', icon: House },
  { href: '/fixtures', label: 'Fixtures', icon: ClipboardList },
  { href: '/results', label: 'Results', icon: Calendar },
] as const

export default function BottomTabBar({ profile, unreadCount = 0 }: BottomTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'
  const supabase = createClient()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function closeMore() {
    setMoreOpen(false)
  }

  // On admin pages show the admin-oriented tab bar instead of the normal one.
  if (pathname.startsWith('/admin') && isAdmin) {
    return <AdminTabBar profile={profile} />
  }

  return (
    <>
      {/* Tab bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
        <div className="flex items-center justify-around h-14 mx-3 mb-3 rounded-2xl bg-bg-surface/80 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] safe-area-bottom">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors active:scale-95 ${
                isActive(href)
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          ))}

          {/* More tab */}
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

      {/* More sheet overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={closeMore}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* More sheet panel */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 lg:hidden rounded-t-2xl bg-bg-surface border-t border-border shadow-xl transition-transform duration-300 ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>

        <div className="px-space-4 pb-space-8 space-y-space-1">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider pt-space-2 pb-space-1">
            Navigation
          </p>

          <MobileMoreLink href="/hall-of-fame" icon={Award} label="Hall of Fame" onClick={closeMore} />
          <MobileMoreLink href="/rules" icon={ScrollText} label="Rules" onClick={closeMore} />


          <div className="border-t border-border my-space-2" />
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider pt-space-1 pb-space-1">
            Account
          </p>

          {profile ? (
            <>
              <MobileMoreLink href="/profile" icon={User} label="Profile" onClick={closeMore} />
              <MobileMoreLink
                href="/notifications"
                icon={Bell}
                label="Notifications"
                onClick={closeMore}
                badge={unreadCount}
              />
              {isAdmin && (
                <MobileMoreLink href="/admin/dashboard" icon={Shield} label="Admin" onClick={closeMore} />
              )}
              <button
                onClick={() => { closeMore(); handleLogout() }}
                className="flex items-center gap-space-3 w-full px-space-4 py-space-3 rounded-lg text-feedback-error hover:bg-feedback-error/10 transition-colors text-sm font-medium"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Logout
              </button>
            </>
          ) : (
            <MobileMoreLink href="/login" icon={User} label="Log in" onClick={closeMore} />
          )}
        </div>
      </div>

      {/* Spacer for tab bar height */}
      <div className="h-20 lg:hidden" />
    </>
  )
}

function MobileMoreLink({
  href,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-space-3 px-space-4 py-space-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors text-sm font-medium"
    >
      <Icon className="w-5 h-5 shrink-0 text-text-muted" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="w-5 h-5 bg-accent text-bg-base text-[10px] font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}
