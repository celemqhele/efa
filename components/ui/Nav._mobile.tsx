'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell } from 'lucide-react'

interface NavMobileProps {
  profile?: any | null
  unreadCount?: number
  handleLogout: () => void
}

export default function NavMobile({ profile, unreadCount = 0 }: NavMobileProps) {
  return (
    <>
      <Link
        href="/"
        className="fixed top-3 left-3 z-50 w-8 h-8 rounded-full bg-bg-surface/80 backdrop-blur border border-border/50 shadow flex items-center justify-center"
      >
        <Image
          src="/efa-logo-white.png"
          alt="EFA"
          width={18}
          height={18}
          className="w-[18px] h-[18px] object-contain"
        />
      </Link>

      {profile && (
        <Link
          href="/notifications"
          className="fixed top-3 right-3 z-50 w-8 h-8 rounded-full bg-bg-surface/80 backdrop-blur border border-border/50 shadow flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-accent text-bg-base text-[8px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      )}
    </>
  )
}
