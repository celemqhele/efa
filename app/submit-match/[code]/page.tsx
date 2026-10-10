import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { APP_BASE, buildState, loadFixture, resolveViewer } from '@/lib/submit-match'
import SubmitPortal from './_portal'
import PageWrapper from '@/components/ui/PageWrapper'

export const dynamic = 'force-dynamic'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageWrapper>
      <div className="min-h-[60vh] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md bg-bg-surface border border-border rounded-2xl p-6 text-center space-y-4">
          {children}
        </div>
      </div>
    </PageWrapper>
  )
}

export default async function SubmitMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { code: rawCode } = await params
  const sp = await searchParams
  const code = (rawCode ?? '').trim().toUpperCase()
  const action = sp.action === 'backdoor' ? '?action=backdoor' : ''
  const redirectTarget = `/submit-match/${encodeURIComponent(code)}${action}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
  }

  const admin = await createAdminClient()
  const fixture = await loadFixture(admin, code)

  if (!fixture) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-text-primary">Match code not found</h1>
        <p className="text-sm text-text-secondary">
          This link does not match a fixture. Ask the admin for a fresh match link.
        </p>
        <Link href="/" className="inline-block text-sm font-semibold text-accent">
          Back to home
        </Link>
      </Shell>
    )
  }

  const viewer = await resolveViewer(admin, user.id, fixture)

  if (!viewer.side && !viewer.isAdmin) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-text-primary">Not your match</h1>
        <p className="text-sm text-text-secondary">
          This match belongs to two other managers, so only they can submit against it.
        </p>
        <Link href="/" className="inline-block text-sm font-semibold text-accent">
          Back to home
        </Link>
      </Shell>
    )
  }

  const state = await buildState(admin, fixture, viewer, code)

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-2xl py-6 px-4">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          EFA match submission
        </p>
        <SubmitPortal initialState={state} initialAction={sp.action ?? null} appBase={APP_BASE} />
      </div>
    </PageWrapper>
  )
}
