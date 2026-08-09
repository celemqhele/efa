export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Shell from './_shell'

export const revalidate = 0

export default async function PushShooterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  return (
    <Shell data={{
      subscribedCount: count ?? 0,
    }} />
  )
}
