import { Suspense } from 'react'
import MobileGestures from './MobileGestures'
import NavShell from './NavShell'

interface PageWrapperProps {
  children: React.ReactNode
  fullWidth?: boolean
}

function NavSkeleton() {
  // Only the desktop nav contributes in-flow height (Nav._desktop renders its
  // own `hidden lg:block h-24` spacer). The mobile nav is entirely `fixed`, so
  // a 64px bar here was 64px of dead space that then vanished on hydration.
  return (
    <div aria-hidden className="hidden lg:block h-16 border-b border-white/5 bg-transparent" />
  )
}

export default function PageWrapper({ children, fullWidth = false }: PageWrapperProps) {
  return (
    <div className="min-h-dvh bg-bg-base">
      <MobileGestures />
      <Suspense fallback={<NavSkeleton />}>
        <NavShell />
      </Suspense>
      {/* Mobile gutters live here (px-4) and the top padding is small (pt-4):
          the mobile nav is `fixed`, so the old `px-6 pt-12` meant 32px of
          gutters *plus* the page's own px-4 (48px total) and 160px of blank
          space above the first heading. Bottom clearance now matches the
          fixed tab bar's height + safe area, which replaces the `h-20`
          spacers that used to sit above <main> in BottomTabBar/AdminTabBar. */}
      <main className={fullWidth ? '' : 'max-w-[1440px] mx-auto px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:px-6 lg:pt-0 lg:pb-space-8'}>
        {children}
      </main>
    </div>
  )
}
