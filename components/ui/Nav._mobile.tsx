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
      <div className="flex items-center justify-between h-8 px-2">
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <Image
            src="/efa-logo-white.png"
            alt="EFA"
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
          />
          <span className="font-bold text-text-primary text-[10px]">EFA</span>
        </Link>

        <div className="flex items-center">
          {profile && (
            <Link
              href="/notifications"
              className="relative p-1 rounded-md text-text-muted hover:text-text-primary transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent text-bg-base text-[7px] font-bold rounded-full flex items-center justify-center">
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
