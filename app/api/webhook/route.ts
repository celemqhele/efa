import { NextRequest, NextResponse } from 'next/server'
import {
  getMediaUrl,
  fetchImageBytes,
  sendTextMessage,
  analyzeScreenshot,
  cleanOcrText,
  cleanOcrWithGroq,
  conversationalReply,
} from '@/lib/whatsapp'

import { parseScreenshot } from '@/lib/screenshot-parser'
import { createAdminClient } from '@/lib/supabase/server'
import { CAT_SYSTEM_PROMPT, buildConversationContext, formatStatsBlock } from '@/lib/system-prompt'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const changes = body?.entry?.[0]?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages
    const metadata = value?.metadata
    if (!messages?.length) return new NextResponse(null, { status: 200 })

    const msg = messages[0]
    const from = msg.from as string
    const phoneNumberId = metadata?.phone_number_id as string
    console.log(`[webhook] from=${from} type=${msg.type}`)

    if (msg.type === 'image') {
      await handleImage(from, msg, phoneNumberId)
    } else if (msg.type === 'text') {
      await handleText(from, msg, phoneNumberId)
    }

    return new NextResponse(null, { status: 200 })
  } catch (err) {
    console.error('[webhook] error:', err)
    return new NextResponse(null, { status: 200 })
  }
}

// ─── Session helpers ─────────────────────────────────────────────────────────────

type SessionData = {
  phone_number: string
  state: string
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  match_stats: Record<string, { home: number; away: number }> | null
  matched_fixture_id: string | null
  screenshot_media_id: string | null
  displayed_fixtures: string[] | null
}

async function getSession(phoneNumber: string): Promise<SessionData | null> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase.from('whatsapp_sessions').select('*').eq('phone_number', phoneNumber).maybeSingle()
  if (error) console.error('[webhook] getSession error:', error)
  return data as SessionData | null
}

async function upsertSession(session: Partial<SessionData> & { phone_number: string }) {
  const supabase = await createAdminClient()
  const { error } = await supabase.from('whatsapp_sessions').upsert({ ...session, updated_at: new Date().toISOString() })
  if (error) console.error('[webhook] upsertSession failed:', error)
}

async function clearSession(phoneNumber: string) {
  const supabase = await createAdminClient()
  await supabase.from('whatsapp_sessions').delete().eq('phone_number', phoneNumber)
}

// ─── Text handler (LLM-driven) ───────────────────────────────────────────────────

async function handleText(from: string, msg: { text: { body: string } }, phoneNumberId: string) {
  const text = (msg.text.body || '').trim()
  console.log(`[webhook] text: "${text}"`)

  const session = await getSession(from)
  const supabase = await createAdminClient()

  // Direct bypass: if session has matched_fixture_id and user says anything affirmative, write to DB
  if (session?.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
    const lower = text.toLowerCase()
    const affirmative = /^(yes|yeah|yep|y|ok|okay|sure|confirm|correct|right|go ahead|submit|looks good|good|fine|ja)$/i
    if (affirmative.test(lower) || lower.includes('yes') || lower.includes('confirm') || lower.includes('submit')) {
      console.log('[webhook] direct bypass: matched_fixture_id set, user affirmed, writing to DB')
      await writeResultToDb(from, session, supabase, phoneNumberId)
      return
    }
  }

  // Direct number selection: if user sends a number and has pending scores, match fixture in code
  if (session && session.home_score !== null && session.away_score !== null && !session.matched_fixture_id) {
    const num = parseInt(text.trim(), 10)
    if (!isNaN(num) && num > 0) {
      // Use cached displayed fixtures if available, otherwise query fresh
      let fixtureIds: string[] | null = session.displayed_fixtures || null
      if (!fixtureIds || fixtureIds.length === 0) {
        const today = new Date().toISOString().split('T')[0]
        const { data: todayFixtures } = await supabase
          .from('fixtures')
          .select('id')
          .eq('scheduled_date', today).eq('status', 'scheduled')
          .order('matchday', { ascending: true })
        fixtureIds = (todayFixtures as any[])?.map((f) => f.id) || null
      }

      if (fixtureIds && num <= fixtureIds.length) {
        const chosenId = fixtureIds[num - 1]
        // Fetch full fixture details
        const { data: chosenFixture } = await supabase
          .from('fixtures')
          .select('id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
          .eq('id', chosenId)
          .single()

        if (chosenFixture) {
          const cf = chosenFixture as any
          const hName = (Array.isArray(cf.home_team) ? cf.home_team[0]?.name : cf.home_team?.name) || '?'
          const aName = (Array.isArray(cf.away_team) ? cf.away_team[0]?.name : cf.away_team?.name) || '?'
          console.log('[webhook] direct number select:', num, '→ fixture:', chosenId, hName, 'vs', aName)

          await upsertSession({
            phone_number: from,
            matched_fixture_id: chosenId,
            home_team: session.home_team,
            away_team: session.away_team,
            home_score: session.home_score,
            away_score: session.away_score,
            match_stats: session.match_stats,
          })

          const statsBlock = formatStatsBlock(session.match_stats)
          await sendTextMessage(from, `Confirm result: ${hName} vs ${aName}, ${session.home_score}-${session.away_score}?${statsBlock ? '\n\n' + statsBlock : ''}\n\nReply YES to submit or let me know what's wrong.`, phoneNumberId)
          return
        }
      }
    }
  }

  // Build context for LLM
  let availableFixtures: any[] | null = null
  if (session?.home_team || session?.away_team) {
    const today = new Date().toISOString().split('T')[0]
    const { data: fixtures } = await supabase
      .from('fixtures')
      .select('id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name)')
      .eq('scheduled_date', today).eq('status', 'scheduled')
      .order('matchday', { ascending: true })
    availableFixtures = (fixtures as any[]) || []
  }

  const context = buildConversationContext({
    userMessage: text,
    session,
    availableFixtures,
    standingsData: null,
    resultsData: null,
    isManager: true,
  })

  const intent = await conversationalReply(CAT_SYSTEM_PROMPT, context)
  console.log('[webhook] LLM intent:', intent.intent, 'matchedFixtureId:', session?.matched_fixture_id, 'scores:', session?.home_score, session?.away_score)

  switch (intent.intent) {
    case 'confirm': {
      if (!session) { await sendTextMessage(from, intent.reply, phoneNumberId); return }

      // If LLM selected a fixture by number, update session with matched fixture
      if (!session.matched_fixture_id && intent.fixtureChoice != null && availableFixtures?.length) {
        const idx = intent.fixtureChoice - 1
        const chosen = availableFixtures[idx]
        if (chosen) {
          console.log('[webhook] LLM selected fixture:', chosen.id, 'via choice:', intent.fixtureChoice)
          await upsertSession({
            phone_number: from,
            matched_fixture_id: chosen.id,
            home_team: session.home_team || chosen.home_team,
            away_team: session.away_team || chosen.away_team,
          })
          session.matched_fixture_id = chosen.id
        }
      }

      // If we have matched fixture + scores, write to DB immediately
      if (session.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
        await writeResultToDb(from, session, supabase, phoneNumberId); return
      }
      await sendTextMessage(from, intent.reply, phoneNumberId)
      return
    }
    case 'correct': {
      if (!session || !intent.corrections) { await sendTextMessage(from, intent.reply, phoneNumberId); return }
      const c = intent.corrections
      await upsertSession({
        phone_number: from,
        home_team: c.homeTeam ?? session.home_team,
        away_team: c.awayTeam ?? session.away_team,
        home_score: c.homeScore ?? session.home_score,
        away_score: c.awayScore ?? session.away_score,
      })
      await sendTextMessage(from, intent.reply, phoneNumberId)
      return
    }
    case 'query_fixtures': {
      const today = new Date().toISOString().split('T')[0]
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('id, matchday, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name)')
        .eq('scheduled_date', today).eq('status', 'scheduled').order('matchday')
      if (!fixtures?.length) { await sendTextMessage(from, "No games scheduled for today.", phoneNumberId); return }
      const lines = (fixtures as any[]).map((f) => {
        const hN = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name) || '?'
        const aN = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name) || '?'
        return `${hN} vs ${aN}`
      })
      await sendTextMessage(from, `Today's fixtures:\n\n${lines.join('\n')}`, phoneNumberId)
      return
    }
    case 'query_standings': {
      const { data: standings } = await supabase
        .from('standings').select('team:teams(name), played, wins, draws, losses, goals_for, goals_against, points')
        .order('points', { ascending: false }).order('goal_difference', { ascending: false }).limit(5)
      if (!standings?.length) { await sendTextMessage(from, "No standings yet.", phoneNumberId); return }
      const lines = (standings as any[]).map((s, i) => {
        const team = Array.isArray(s.team) ? s.team[0]?.name : s.team?.name
        return `${i + 1}. ${team} — ${s.played}P ${s.wins}W ${s.draws}D ${s.losses}L · GF:${s.goals_for} GA:${s.goals_against} · ${s.points}pts`
      })
      await sendTextMessage(from, `Top of the table:\n\n${lines.join('\n')}`, phoneNumberId)
      return
    }
    case 'query_results': {
      const { data: results } = await supabase
        .from('results').select('home_score, away_score, fixture:fixtures(home_team:teams(name), away_team:teams(name)), created_at')
        .order('created_at', { ascending: false }).limit(5)
      if (!results?.length) { await sendTextMessage(from, "No results yet.", phoneNumberId); return }
      const lines = (results as any[]).map((r) => {
        const f = Array.isArray(r.fixture) ? r.fixture[0] : r.fixture
        const hN = Array.isArray(f?.home_team) ? f.home_team[0]?.name : f?.home_team?.name
        const aN = Array.isArray(f?.away_team) ? f.away_team[0]?.name : f?.away_team?.name
        return `${hN} ${r.home_score}-${r.away_score} ${aN}`
      })
      await sendTextMessage(from, `Latest results:\n\n${lines.join('\n')}`, phoneNumberId)
      return
    }
    case 'cancel': { await clearSession(from); await sendTextMessage(from, intent.reply, phoneNumberId); return }
    default: { await sendTextMessage(from, intent.reply, phoneNumberId); return }
  }
}

// ─── Image handler ───────────────────────────────────────────────────────────────

async function handleImage(from: string, msg: { image: { id: string; mime_type: string } }, phoneNumberId: string) {
  await sendTextMessage(from, "Shot, let me take a look... \uD83D\uDC40", phoneNumberId)

  const imageId = msg.image.id
  const mediaUrl = await getMediaUrl(imageId)
  const { buffer, mimeType } = await fetchImageBytes(mediaUrl)
  console.log(`[webhook] downloaded ${buffer.length} bytes`)

  let ocrResult: Awaited<ReturnType<typeof parseScreenshot>> | null = null
  try { ocrResult = await parseScreenshot(buffer) } catch {}
  console.log('[webhook] OCR rawText length:', ocrResult?.rawText?.length || 0, 'stats:', ocrResult?.stats ? Object.keys(ocrResult.stats).length : 0)

  let homeTeam: string | null = null, awayTeam: string | null = null
  let homeScore: number | null = null, awayScore: number | null = null
  let matchStats: Record<string, { home: number; away: number }> | null = null
  let invalidReason: string | null = null
  let textScoreSource: string | null = null

  if (ocrResult?.rawText) {
    try {
      const cleaned = await cleanOcrText(ocrResult.rawText)
      if (cleaned) {
        console.log('[webhook] Gemini cleaned - score:', cleaned.homeScore, cleaned.awayScore, 'stats:', cleaned.matchStats ? Object.keys(cleaned.matchStats).length : 0)
        if (cleaned.valid === false) invalidReason = cleaned.reason || null
        else { homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats; textScoreSource = 'gemini-text' }
      }
    } catch {
      try {
        const cleaned = await cleanOcrWithGroq(ocrResult.rawText)
        if (cleaned) {
          console.log('[webhook] Groq cleaned - score:', cleaned.homeScore, cleaned.awayScore, 'stats:', cleaned.matchStats ? Object.keys(cleaned.matchStats).length : 0)
          if (cleaned.valid === false) invalidReason = cleaned.reason || null
          else { homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats; textScoreSource = 'groq-text' }
        }
      } catch {}
    }
  }

  if (homeScore === null && ocrResult) {
    console.log('[webhook] OCR parsed fallback - score:', ocrResult.homeScore, ocrResult.awayScore, 'stats:', Object.keys(ocrResult.stats).length)
    homeScore = ocrResult.homeScore || null; awayScore = ocrResult.awayScore || null
    homeTeam = homeTeam || ocrResult.homeTeamOcr || null; awayTeam = awayTeam || ocrResult.awayTeamOcr || null
    if (homeScore !== null) textScoreSource = 'ocr-parsed'
  }

  // Always use OCR parsed stats as fallback (even if AI got scores but not stats)
  if (!matchStats && ocrResult?.stats && Object.keys(ocrResult.stats).length > 0) {
    console.log('[webhook] using OCR parsed stats as fallback, count:', Object.keys(ocrResult.stats).length)
    matchStats = ocrResult.stats
  }

  // Cross-validate: always try vision to verify scores from text extraction
  let visionScoreSource: string | null = null
  try {
    console.log('[webhook] trying Gemini vision for cross-validation')
    const geminiResult = await analyzeScreenshot(buffer, mimeType)
    if (geminiResult) {
      console.log('[webhook] Gemini vision - score:', geminiResult.homeScore, geminiResult.awayScore, 'stats:', geminiResult.matchStats ? Object.keys(geminiResult.matchStats).length : 0)
      if (geminiResult.valid === false) {
        if (!invalidReason) invalidReason = geminiResult.reason || null
      } else {
        visionScoreSource = 'gemini-vision'
        // If vision got scores and they differ from text extraction, prefer vision
        if (geminiResult.homeScore != null && geminiResult.awayScore != null) {
          if (homeScore !== null && awayScore !== null &&
              (homeScore !== geminiResult.homeScore || awayScore !== geminiResult.awayScore)) {
            console.log(`[webhook] SCORE MISMATCH: text=${textScoreSource}(${homeScore}-${awayScore}) vs vision(${geminiResult.homeScore}-${geminiResult.awayScore}) — preferring vision`)
          }
          homeScore = geminiResult.homeScore; awayScore = geminiResult.awayScore
        }
        homeTeam = geminiResult.homeTeam || homeTeam; awayTeam = geminiResult.awayTeam || awayTeam
        // Prefer vision stats if text extraction had none
        if (!matchStats && geminiResult.matchStats) matchStats = geminiResult.matchStats
      }
    }
  } catch {}

  console.log('[webhook] final - team:', homeTeam, awayTeam, 'score:', homeScore, awayScore, 'source:', visionScoreSource || textScoreSource || 'none', 'statsKeys:', matchStats ? Object.keys(matchStats).join(',') : 'none')

  if (invalidReason) { await sendTextMessage(from, `Yoh, this doesn't look like a match result — ${invalidReason}.`, phoneNumberId); return }
  if (homeScore === null || awayScore === null) { await sendTextMessage(from, "Sorry, I couldn't read the scores.", phoneNumberId); return }

  const supabase = await createAdminClient()

  // Keyword-based fixture matching (same logic as admin ResultSubmitClient search)
  const searchWords = [homeTeam, awayTeam]
    .filter(Boolean)
    .flatMap((name) => name!.toLowerCase().split(/\s+/))
    .filter((w) => w.length >= 2)

  // Search today's fixtures for a match
  const today = new Date().toISOString().split('T')[0]
  const { data: todayFixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name)')
    .eq('scheduled_date', today).eq('status', 'scheduled').order('matchday')

  const fixtures = (todayFixtures as any[]) || []

  function fixtureMatchesAllWords(f: any): boolean {
    const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
    const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
    const combined = `${hName} vs ${aName}`
    return searchWords.length > 0 && searchWords.every((w) => combined.includes(w))
  }

  function fixtureMatchesAnyWord(f: any): boolean {
    const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
    const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
    const combined = `${hName} vs ${aName}`
    return searchWords.some((w) => combined.includes(w))
  }

  // Try keyword match — all OCR words must appear in fixture name
  let matchedFixture: any = null
  if (searchWords.length > 0) {
    const keywordMatches = fixtures.filter(fixtureMatchesAllWords)
    if (keywordMatches.length === 1) {
      matchedFixture = keywordMatches[0]
    } else if (keywordMatches.length > 1) {
      // Multiple keyword matches — prefer exact team pair if possible
      const homeWords = (homeTeam || '').toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2)
      const awayWords = (awayTeam || '').toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2)
      matchedFixture = keywordMatches.find((f: any) => {
        const hName = ((Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name) || '').toLowerCase()
        const aName = ((Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name) || '').toLowerCase()
        const homeSideMatch = homeWords.length > 0 && homeWords.every((w: string) => hName.includes(w))
        const awaySideMatch = awayWords.length > 0 && awayWords.every((w: string) => aName.includes(w))
        return (homeSideMatch && awaySideMatch) || (homeWords.every((w: string) => aName.includes(w)) && awayWords.every((w: string) => hName.includes(w)))
      }) || null
    }
  }

  if (matchedFixture) {
    const hName = (Array.isArray(matchedFixture.home_team) ? matchedFixture.home_team[0]?.name : matchedFixture.home_team?.name) || homeTeam || '?'
    const aName = (Array.isArray(matchedFixture.away_team) ? matchedFixture.away_team[0]?.name : matchedFixture.away_team?.name) || awayTeam || '?'

    await upsertSession({
      phone_number: from,
      home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
      match_stats: matchStats, matched_fixture_id: matchedFixture.id, screenshot_media_id: imageId,
    })

    const statsBlock = formatStatsBlock(matchStats)
    console.log('[webhook] keyword matched fixture:', hName, 'vs', aName, 'words:', searchWords)
    await sendTextMessage(from, `Confirm result: ${hName} vs ${aName}, ${homeScore}-${awayScore}?${statsBlock ? '\n\n' + statsBlock : ''}\n\nReply YES to submit or let me know what's wrong.`, phoneNumberId)
    return
  }

  // No match found — narrow list to fixtures matching ANY word, or show all
  let displayFixtures = fixtures
  if (searchWords.length > 0) {
    const partialMatches = fixtures.filter(fixtureMatchesAnyWord)
    if (partialMatches.length > 0) displayFixtures = partialMatches
  }

  await upsertSession({
    phone_number: from,
    home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
    match_stats: matchStats, matched_fixture_id: null, screenshot_media_id: imageId,
    displayed_fixtures: displayFixtures.map((f: any) => f.id),
  })

  if (displayFixtures.length > 0) {
    const lines = displayFixtures.map((f: any, i: number) => {
      const hN = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name) || '?'
      const aN = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name) || '?'
      return `${i + 1}. ${hN} vs ${aN}`
    })
    const intro = searchWords.length > 0
      ? `Couldn't auto-match exactly, but here are fixtures involving ${homeTeam || '?'} or ${awayTeam || '?'}:`
      : "Couldn't auto-match. Today's fixtures:"
    await sendTextMessage(from, `${intro}\n\n${lines.join('\n')}\n\nReply with the number of your match.`, phoneNumberId)
  } else {
    await sendTextMessage(from, `No scheduled fixtures found for today. Your result has been saved — contact an admin to match it.`, phoneNumberId)
    await clearSession(from)
  }
}

// ─── DB write ────────────────────────────────────────────────────────────────────

const STAT_KEY_TO_DB: Record<string, [string, string]> = {
  possession: ['home_possession', 'away_possession'],
  shots: ['home_shots', 'away_shots'],
  shotsOnTarget: ['home_shots_on_target', 'away_shots_on_target'],
  fouls: ['home_fouls', 'away_fouls'],
  offsides: ['home_offsides', 'away_offsides'],
  cornerKicks: ['home_corners', 'away_corners'],
  freeKicks: ['home_free_kicks', 'away_free_kicks'],
  passes: ['home_passes', 'away_passes'],
  successfulPasses: ['home_successful_passes', 'away_successful_passes'],
  crosses: ['home_crosses', 'away_crosses'],
  interceptions: ['home_interceptions', 'away_interceptions'],
  tackles: ['home_tackles', 'away_tackles'],
  saves: ['home_saves', 'away_saves'],
}

function matchStatsToDbColumns(matchStats: Record<string, { home: number; away: number }> | null): Record<string, number> | null {
  if (!matchStats) return null
  const cols: Record<string, number> = {}
  for (const [key, [homeCol, awayCol]] of Object.entries(STAT_KEY_TO_DB)) {
    const s = matchStats[key]
    if (s && s.home !== null && s.away !== null) {
      cols[homeCol] = s.home
      cols[awayCol] = s.away
    }
  }
  return Object.keys(cols).length > 0 ? cols : null
}

async function getAdminUserId(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', 'celemqhele')
    .maybeSingle()
  if (error || !data) {
    console.error('[webhook] failed to look up admin user celemqhele:', error?.message)
    return null
  }
  return data.id
}

async function writeResultToDb(from: string, session: SessionData, supabase: any, phoneNumberId: string) {
  if (!session.matched_fixture_id || session.home_score === null || session.away_score === null) {
    await clearSession(from); await sendTextMessage(from, 'Something went wrong.', phoneNumberId); return
  }

  const adminUserId = await getAdminUserId(supabase)
  console.log('[webhook] admin user celemqhele id:', adminUserId || 'NOT FOUND')

  // Write to result_confirmations (audit trail, submitted by admin)
  const { error: rcErr } = await supabase
    .from('result_confirmations')
    .insert({
      fixture_id: session.matched_fixture_id,
      home_score: session.home_score,
      away_score: session.away_score,
      submitted_by: adminUserId,
    })
  if (rcErr) console.error('[webhook] confirmations insert failed:', rcErr.message)

  // Upsert into results table (triggers standings update via DB trigger)
  const { data: resultRow, error: resultErr } = await supabase
    .from('results')
    .upsert({
      fixture_id: session.matched_fixture_id,
      home_score: session.home_score,
      away_score: session.away_score,
      ...(adminUserId ? { finalised_by: adminUserId } : {}),
    }, { onConflict: 'fixture_id' })
    .select('id')
    .maybeSingle()
  if (resultErr) console.error('[webhook] results upsert failed:', resultErr.message)

  // Write match_stats if we have them and got a result ID
  const dbStats = matchStatsToDbColumns(session.match_stats)
  if (resultRow?.id && dbStats) {
    const { error: statsErr } = await supabase
      .from('match_stats')
      .upsert({ result_id: resultRow.id, ...dbStats }, { onConflict: 'result_id' })
    if (statsErr) console.error('[webhook] match_stats insert failed:', statsErr.message)
    else console.log('[webhook] match_stats written for result:', resultRow.id)
  }

  // Update fixture status
  const { error: fixtureErr } = await supabase
    .from('fixtures')
    .update({ status: 'confirmed' })
    .eq('id', session.matched_fixture_id)
  if (fixtureErr) console.error('[webhook] fixture status update failed:', fixtureErr.message)

  console.log('[webhook] result written:', { fixture_id: session.matched_fixture_id, home_score: session.home_score, away_score: session.away_score, submitted_by: adminUserId })
  await clearSession(from)
  await sendTextMessage(from, 'Shot! Result submitted. \u{1F3AE}', phoneNumberId)
}
