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
    <nav className="sticky top-0 z-50 bg-bg-surface/80 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-10 px-3">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <Image
            src="/efa-logo-white.png"
            alt="EFA"
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
          <span className="font-bold text-text-primary text-xs">EFA</span>
        </Link>

        <div className="flex items-center gap-0.5">
          {profile && (
            <Link
              href="/notifications"
              className="relative p-1.5 rounded-md text-text-muted hover:text-text-primary transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-accent text-bg-base text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
