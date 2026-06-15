import { createAdminClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export default async function PollsPage() {
  const adminSupabase = await createAdminClient()

  const { data: polls } = await adminSupabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .order('created_at', { ascending: false })

  return <Shell data={{ polls: polls ?? [] }} />
}
