'use client'

import { usePathname } from 'next/navigation'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export default function MessagesShell({ sidebar, children }: Props) {
  const pathname = usePathname()
  // At /messages root: mobile shows sidebar only, desktop shows sidebar + lounge
  const inConversation = pathname !== '/messages'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${inConversation ? 'hidden md:flex' : 'flex w-full'} md:w-80 md:flex shrink-0 flex-col`}
      >
        {sidebar}
      </div>

      {/* Main chat panel */}
      <div
        className={`${inConversation ? 'flex w-full' : 'hidden md:flex'} flex-1 min-w-0 flex-col bg-navy-light`}
      >
        {children}
      </div>
    </div>
  )
}
