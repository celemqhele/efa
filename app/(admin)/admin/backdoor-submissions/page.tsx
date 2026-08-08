import { createClient } from '@supabase/supabase-js'
import Shell from './_shell'

export const revalidate = 0

export default async function BackdoorSubmissionsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: submissions } = await supabase
    .from('backdoor_submissions')
    .select(`
      id,
      fixture_id,
      submitter_phone,
      side_claimed,
      screenshot_url,
      status,
      created_at,
      expires_at,
      reviewed_at,
      reviewed_by,
      fixtures!inner(
        id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name),
        scheduled_date,
        status
      )
    `)
    .order('created_at', { ascending: false })

  // Group by fixture
  const byFixture = new Map<string, any[]>()
  for (const s of (submissions ?? []) as any[]) {
    const key = s.fixture_id
    if (!byFixture.has(key)) byFixture.set(key, [])
    byFixture.get(key)!.push(s)
  }

  return (
    <Shell
      data={{
        groupedSubmissions: Array.from(byFixture.entries()),
      }}
    />
  )
}