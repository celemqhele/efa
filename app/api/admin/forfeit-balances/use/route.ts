import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = await createAdminClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as any).role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { balance_id, fixture_id } = await request.json()
  if (!balance_id) {
    return Response.json({ error: 'balance_id is required' }, { status: 400 })
  }

  const { data: balance, error: fetchError } = await supabaseAdmin
    .from('forfeit_balances')
    .select('id, remaining, forfeiting_team_id, opponent_team_id, forfeiting_score, opponent_score')
    .eq('id', balance_id)
    .single()

  if (fetchError || !balance) {
    return Response.json({ error: 'Forfeit balance not found' }, { status: 404 })
  }

  if ((balance as any).remaining <= 0) {
    return Response.json({ error: 'Forfeit balance already exhausted' }, { status: 400 })
  }

  // If fixture_id provided, verify it matches the balance's teams and apply aggregate
  if (fixture_id) {
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from('fixtures')
      .select('id, home_team_id, away_team_id, tournament_id, status')
      .eq('id', fixture_id)
      .single()

    if (fixtureError || !fixture) {
      return Response.json({ error: 'Fixture not found' }, { status: 404 })
    }

    // Verify fixture involves the same two teams (either order)
    const isCorrectMatchup = 
      (fixture.home_team_id === balance.forfeiting_team_id && fixture.away_team_id === balance.opponent_team_id) ||
      (fixture.home_team_id === balance.opponent_team_id && fixture.away_team_id === balance.forfeiting_team_id)

    if (!isCorrectMatchup) {
      return Response.json({ error: 'Forfeit balance does not apply to this fixture (different opponent)' }, { status: 400 })
    }

    // Get current result for this fixture
    const { data: result, error: resultError } = await supabaseAdmin
      .from('results')
      .select('id, home_score, away_score')
      .eq('fixture_id', fixture_id)
      .single()

    if (resultError || !result) {
      return Response.json({ error: 'No result found for this fixture yet' }, { status: 400 })
    }

    // Apply aggregate: add forfeit scores to current result
    let newHomeScore = result.home_score
    let newAwayScore = result.away_score

    const forfeitingIsHome = fixture.home_team_id === balance.forfeiting_team_id
    if (forfeitingIsHome) {
      newHomeScore += balance.forfeiting_score
      newAwayScore += balance.opponent_score
    } else {
      newAwayScore += balance.forfeiting_score
      newHomeScore += balance.opponent_score
    }

    // Update result with aggregate score
    const { error: updateResultError } = await supabaseAdmin
      .from('results')
      .update({ home_score: newHomeScore, away_score: newAwayScore })
      .eq('id', result.id)

    if (updateResultError) {
      return Response.json({ error: updateResultError.message }, { status: 500 })
    }

    // Mark balance as used
    const { error: updateError } = await supabaseAdmin
      .from('forfeit_balances')
      .update({ remaining: 0 })
      .eq('id', balance_id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    // Recalculate standings
    if (fixture.tournament_id) {
      try { await recalculateStandings(fixture.tournament_id) } catch (e) { console.error('[forfeit-balance-use] standings recalc failed:', e) }
    }

    return Response.json({ 
      success: true, 
      remaining: 0,
      aggregate: { home_score: newHomeScore, away_score: newAwayScore }
    })
  }

  // Fallback: just decrement remaining (legacy behavior)
  const { error: updateError } = await supabaseAdmin
    .from('forfeit_balances')
    .update({ remaining: (balance as any).remaining - 1 })
    .eq('id', balance_id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ success: true, remaining: (balance as any).remaining - 1 })
}
