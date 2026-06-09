import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-space-8">
      <div className="text-center max-w-md">
        <p className="text-7xl font-black text-accent mb-space-2">404</p>
        <h1 className="text-2xl font-bold text-text-primary mb-space-2">Page not found</h1>
        <p className="text-text-muted text-sm mb-space-8">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" passHref>
          <Button as="a">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  )
}

