import { createAdminClient } from '@/lib/supabase/server'

// Rebuild stored tenure W/D/L from the fixtures those tenures actually own.
//
// The ownership rule must be identical to the one the result triggers use, so
// this deliberately delegates to the `recalc_manager_stats` SQL function instead
// of reimplementing the arithmetic here. It counts only results a tenure owned at
// the moment they were decided (`results.updated_at ?? created_at`), which is what
// keeps an automatic forfeit booked before a same-day replacement with the old
// manager rather than the newcomer. A JS copy of that rule drifted from SQL
// (date-only windows), so SQL is now the single source of truth.
export async function recalculateManagerStats(managerId?: string) {
  const db = await createAdminClient()

  const { data, error } = await (db as any).rpc('recalc_manager_stats', {
    p_manager_id: managerId ?? null,
  })

  if (error) throw new Error(error.message)

  return { success: true, tenuresProcessed: (data as number | null) ?? 0 }
}
