import { createAdminClient } from '@/lib/supabase/server'
import { recalculateManagerStats } from '@/lib/manager-stats-engine'

export async function POST(request: Request) {
  const { managerId } = await request.json()

  try {
    const result = await recalculateManagerStats(managerId)
    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
