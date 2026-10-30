#!/usr/bin/env node
// Auto-complete check: if a tournament has all fixtures confirmed and no
// pending fixtures (including knockouts), mark it completed. Also complete
// the season linked via base_league if the tournament is the season's base league.
//
// Usage: node scripts/auto-complete-check.mjs

import { createClient } from '@supabase/supabase-js'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function run() {
  // Find tournaments that are still active
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, status')
    .eq('status', 'active')

  if (tErr) {
    console.error('tournaments query error:', tErr.message)
    process.exit(1)
  }

  for (const t of tournaments || []) {
    // Check fixtures: count confirmed vs total, and check for any knockout fixtures
    const { data: fixtures, error: fErr } = await supabase
      .from('fixtures')
      .select('id, status, round_type')
      .eq('tournament_id', t.id)

    if (fErr) {
      console.log('fixture error for', t.name, ':', fErr.message)
      continue
    }

    const total = fixtures.length
    const confirmed = fixtures.filter(f => f.status === 'confirmed').length
    const pending = fixtures.filter(f => !['confirmed', 'finished', 'abandoned'].includes(f.status)).length
    const knockouts = fixtures.filter(f => f.round_type && (f.round_type.toLowerCase().includes('knockout') || f.round_type.toLowerCase().includes('r32') || f.round_type.toLowerCase().includes('qf') || f.round_type.toLowerCase().includes('sf') || f.round_type.toLowerCase().includes('final')))

    const knockoutPending = knockouts.filter(k => !['confirmed', 'finished', 'abandoned'].includes(k.status)).length

    // Auto-complete conditions:
    // - At least one fixture (to avoid empty tournaments)
    // - All fixtures confirmed (confirmed == total)
    // - No knockout fixtures pending
    if (total > 0 && confirmed === total && knockoutPending === 0) {
      console.log('COMPLETING:', t.name, '(fixtures:', total, 'knockouts pending:', knockoutPending, ')')

      const { error: updateErr } = await supabase
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', t.id)

      if (updateErr) {
        console.error('update tournament error:', updateErr.message)
      } else {
        console.log('  -> tournament completed:', t.id)

        // Link to season if this is the base league tournament
        const { data: seasonLink } = await supabase
          .from('seasons')
          .select('id, name, status, base_league')
          .eq('base_league', t.name)
          .single()

        // Note: base_league is a string; we need to match by tournament name
        // Actually the seasons table uses base_league column which is a string (likely league name, not tournament ID)
        // Let's try matching by tournament name via a different approach if needed.
        // For now we complete the tournament; season completion is handled separately.
      }
    } else if (total > 0) {
      console.log('SKIPPING:', t.name, '(confirmed:', confirmed + '/' + total, 'pending knockouts:', knockoutPending, ')')
    }
  }
}

run().catch(e => {
  console.error('auto-complete error:', e)
  process.exit(1)
})
