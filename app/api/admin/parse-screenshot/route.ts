import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseScreenshot } from '@/lib/screenshot-parser'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('screenshot')

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'screenshot file is required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let parsed: Awaited<ReturnType<typeof parseScreenshot>>
  try {
    parsed = await parseScreenshot(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed'
    return Response.json({ error: message }, { status: 500 })
  }

  const adminSupabase = await createAdminClient()

  // Look up team_name_mappings for auto-resolution
  const { data: mappings } = await adminSupabase
    .from('team_name_mappings')
    .select('ocr_name, team_id')

  const resolvedMappings: { home?: string; away?: string } = {}

  if (mappings && mappings.length > 0) {
    const homeLower = parsed.homeTeamOcr.toLowerCase()
    const awayLower = parsed.awayTeamOcr.toLowerCase()

    for (const mapping of mappings) {
      const ocrLower = mapping.ocr_name.toLowerCase()
      if (!resolvedMappings.home && homeLower.includes(ocrLower)) {
        resolvedMappings.home = mapping.team_id
      }
      if (!resolvedMappings.away && awayLower.includes(ocrLower)) {
        resolvedMappings.away = mapping.team_id
      }
    }
  }

  return Response.json({
    homeTeamOcr: parsed.homeTeamOcr,
    awayTeamOcr: parsed.awayTeamOcr,
    homeScore: parsed.homeScore,
    awayScore: parsed.awayScore,
    stats: parsed.stats,
    mappings: resolvedMappings,
  })
}
