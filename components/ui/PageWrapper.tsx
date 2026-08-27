import { Suspense } from 'react'
import MobileGestures from './MobileGestures'
import NavShell from './NavShell'

interface PageWrapperProps {
  children: React.ReactNode
  fullWidth?: boolean
}

function NavSkeleton() {
  return (
    <div aria-hidden className="h-16 border-b border-white/5 bg-transparent" />
  )
}

export default function PageWrapper({ children, fullWidth = false }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-navy">
      <MobileGestures />
      <Suspense fallback={<NavSkeleton />}>
        <NavShell />
      </Suspense>
      <main className={fullWidth ? '' : 'max-w-[1440px] mx-auto px-6 pt-12 pb-space-8 lg:pt-0'}>
        {children}
      </main>
    </div>
  )
}