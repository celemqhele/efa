import { createAdminClient } from '@/lib/supabase/server'
import AvailabilityManager from './AvailabilityManager'

export default async function ManagerAvailabilityPage({ searchParams }: { searchParams: Promise<{ managerId: string }> }) {
  const supabase = await createAdminClient()
  const { managerId } = await searchParams

  const { data: avail } = await (supabase as any)
    .from('manager_availability')
    .select('*')
    .eq('profile_id', managerId)
    .maybeSingle()

  const defaultSchedule = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => ({
    day, available: true, start: '18:00', end: '23:00'
  }))

  return (
    <AvailabilityManager
      managerId={managerId}
      initialSchedule={(avail?.schedule as any) ?? defaultSchedule}
      initialType={(avail?.profile_type as any) ?? 'EVERYDAY'}
    />
  )
}
