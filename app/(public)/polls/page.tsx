import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { ogMeta } from '@/lib/og'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = ogMeta({
  title: 'Polls',
  description:
    'Open EFA member votes — club selection polls and manager elections. Sign in to cast your vote.',
  path: '/polls',
  subtitle: 'Member club selection and manager elections',
  badge: 'VOTING',
})

export default async function PollsPage() {
  const adminSupabase = await createAdminClient()

  const { data: polls } = await adminSupabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .order('created_at', { ascending: false })

  return <Shell data={{ polls: polls ?? [] }} />
}
