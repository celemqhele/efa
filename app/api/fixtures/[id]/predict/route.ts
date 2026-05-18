import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: fixture_id } = await params

  let body: { predicted_home_score: number; predicted_away_score: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { predicted_home_score, predicted_away_score } = body

  if (predicted_home_score == null || predicted_away_score == null) {
    return Response.json(
      { error: 'predicted_home_score and predicted_away_score are required' },
      { status: 400 }
    )
  }

  // Check no result exists yet for this fixture
  const { data: existingResult } = await supabase
    .from('results')
    .select('id')
    .eq('fixture_id', fixture_id)
    .maybeSingle()

  if (existingResult) {
    return Response.json(
      { error: 'A result already exists for this fixture — predictions are closed' },
      { status: 409 }
    )
  }

  // Upsert prediction (one per user per fixture)
  const { error: upsertError } = await supabase
    .from('predictions')
    .upsert(
      {
        fixture_id,
        user_id: user.id,
        predicted_home_score,
        predicted_away_score,
      },
      { onConflict: 'fixture_id,user_id' }
    )

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500 })
  }

  return Response.json({ predicted: true })
}
