import { NextRequest, NextResponse } from 'next/server'
import {
  getMediaUrl,
  fetchImageBytes,
  normalizeToLandscape,
  sendTextMessage,
  analyzeScreenshot,
  cleanOcrText,
  cleanOcrWithGroq,
  conversationalReply,
} from '@/lib/whatsapp'

import { parseScreenshot } from '@/lib/screenshot-parser'
import { createAdminClient } from '@/lib/supabase/server'
import { CAT_SYSTEM_PROMPT, buildConversationContext, formatStatsBlock } from '@/lib/system-prompt'
import { sendPushToUsers } from '@/lib/push'
import { parseUserDate } from '@/lib/date-parser'
import { recalculateStandings } from '@/lib/standings-engine'

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
  pending_date: string | null
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

// ─── Text handler ⸺ only handles confirm/correct responses to ongoing result flow ──

function fixtureTeamName(f: any, side: 'home' | 'away'): string {
  const raw = side === 'home' ? f.home_team : f.away_team
  return (Array.isArray(raw) ? raw[0]?.name : raw?.name) || '?'
}

function formatFixtureLine(f: any, index: number): string {
  const hN = fixtureTeamName(f, 'home')
  const aN = fixtureTeamName(f, 'away')
  const result = Array.isArray(f.results) ? f.results[0] : f.results
  if (result && (f.status === 'confirmed' || f.status === 'awaiting_confirmation')) {
    return `${index + 1}. ${hN} ${result.home_score} - ${result.away_score} ${aN} SUBMITTED.`
  }
  return `${index + 1}. ${hN} vs ${aN}`
}

function isFixtureConfirmed(f: any): boolean {
  return f.status === 'confirmed' || f.status === 'awaiting_confirmation'
}

async function handleText(from: string, msg: { text: { body: string } }, phoneNumberId: string) {
  const text = (msg.text.body || '').trim()
  console.log(`[webhook] text: "${text}"`)

  const session = await getSession(from)

  // Only reject users who have no active session at all (never sent a screenshot)
  if (!session || (session.home_score === null && session.away_score === null)) {
    await sendTextMessage(from, "I only help with submitting match results. Send a screenshot of your result screen and I'll take it from there.", phoneNumberId)
    return
  }

  const supabase = await createAdminClient()

  // CANCEL — always works regardless of flow state
  if (/^cancel$/i.test(text.trim())) {
    console.log('[webhook] user CANCEL')
    await clearSession(from)
    await sendTextMessage(from, "No stress. Send a new screenshot when you're ready.", phoneNumberId)
    return
  }

  // Direct bypass: if session has matched_fixture_id and user says anything affirmative, write to DB
  if (session.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
    const lower = text.toLowerCase()
    const affirmative = /^(yes|yeah|yep|y|ok|okay|sure|confirm|correct|right|go ahead|submit|looks good|good|fine|ja)$/i
    if (affirmative.test(lower) || lower.includes('yes') || lower.includes('confirm') || lower.includes('submit')) {
      // Override flow: if fixture is already submitted, do reset + re-submit
      if (session.state === 'awaiting_override_confirm') {
        console.log('[webhook] override confirmed by user, resetting and re-submitting')
        await resetAndResubmit(from, session, supabase, phoneNumberId)
        return
      }
      console.log('[webhook] direct bypass: user affirmed, writing to DB')
      await writeResultToDb(from, session, supabase, phoneNumberId)
      return
    }
    // SWAP — switch home/away sides
    if (/^swap$/i.test(lower)) {
      console.log('[webhook] user SWAP:', session.home_team, 'vs', session.away_team)
      const newHome = session.away_team
      const newAway = session.home_team
      const newHomeScore = session.away_score
      const newAwayScore = session.home_score
      let newStats = session.match_stats
      if (newStats) {
        const swapped: Record<string, { home: number; away: number }> = {}
        for (const [key, val] of Object.entries(newStats)) {
          swapped[key] = { home: val.away, away: val.home }
        }
        newStats = swapped
      }
      await upsertSession({
        phone_number: from,
        home_team: newHome, away_team: newAway,
        home_score: newHomeScore, away_score: newAwayScore,
        match_stats: newStats,
      })
      const statsBlock = formatStatsBlock(newStats)
      await sendTextMessage(from, `Sides swapped!\n\nConfirm result: ${newHome} ${newHomeScore}-${newAwayScore} ${newAway}?${statsBlock ? '\n\n' + statsBlock : ''}\n\nType SWAP if stats are still on the wrong side. Type CANCEL to start again.`, phoneNumberId)
      return
    }
  }

  // "check other date" — restart fixture matching with a different date
  if (/^check other date$/i.test(text.trim())) {
    if (!session || session.home_score === null) {
      await sendTextMessage(from, "Send a screenshot first, then I can help you check a different date.", phoneNumberId)
      return
    }
    await upsertSession({ phone_number: from, state: 'awaiting_date', matched_fixture_id: null, displayed_fixtures: null })
    await sendTextMessage(from, "What date? Type it like \"12 Jul\", \"July 12\", or \"2026-07-12\".", phoneNumberId)
    return
  }

  // Date input: user types a date while in awaiting_date state
  if (session.state === 'awaiting_date') {
    const parsed = parseUserDate(text)
    if (!parsed) {
      await sendTextMessage(from, "Sorry, I didn't catch that. Try something like \"12 Jul\", \"July 12\", or \"2026-07-12\".", phoneNumberId)
      return
    }
    const { dateKey } = parsed
    const { data: dateFixtures } = await supabase
      .from('fixtures')
      .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), results!results_fixture_id_fkey(home_score, away_score)')
      .eq('scheduled_date', dateKey)
      .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
      .order('matchday', { ascending: true })

    const fixtures = (dateFixtures as any[]) || []
    if (fixtures.length === 0) {
      await sendTextMessage(from, `No fixtures found for ${dateKey}. Try a different date.`, phoneNumberId)
      return
    }

    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixture_from_past',
      pending_date: dateKey,
      displayed_fixtures: fixtures.map((f: any) => f.id),
    })

    const lines = fixtures.map((f: any, i: number) => formatFixtureLine(f, i))
    const dateLabel = parsed.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    await sendTextMessage(from, `Fixtures for ${dateLabel}:\n\n${lines.join('\n')}\n\nReply with the number of your match. Type CANCEL to start over.\n\nYour fixture isn't here? Type "check other date".`, phoneNumberId)
    return
  }

  // Past-date fixture selection: user picks a number from a past date's fixtures
  if (session.state === 'awaiting_fixture_from_past') {
    const num = parseInt(text.trim(), 10)
    if (!isNaN(num) && num > 0 && session.displayed_fixtures && num <= session.displayed_fixtures.length) {
      const chosenId = session.displayed_fixtures[num - 1]
      const { data: chosenFixture } = await supabase
        .from('fixtures')
        .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), results!results_fixture_id_fkey(home_score, away_score)')
        .eq('id', chosenId)
        .single()

      if (chosenFixture) {
        const cf = chosenFixture as any
        const hName = fixtureTeamName(cf, 'home')
        const aName = fixtureTeamName(cf, 'away')
        const isAlreadyConfirmed = isFixtureConfirmed(cf)
        const statsBlock = formatStatsBlock(session.match_stats)
        const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''

        await upsertSession({
          phone_number: from,
          matched_fixture_id: chosenId,
          home_team: session.home_team,
          away_team: session.away_team,
          home_score: session.home_score,
          away_score: session.away_score,
          match_stats: session.match_stats,
          state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
        })

        await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type CANCEL to start over.\n\nYour fixture isn't here? Type "check other date".`, phoneNumberId)
        return
      }
    }
    await sendTextMessage(from, "Please reply with a valid number from the list.", phoneNumberId)
    return
  }

  // Direct number selection: if user sends a number and has pending scores, match fixture
  if (session && session.home_score !== null && session.away_score !== null && !session.matched_fixture_id) {
    const num = parseInt(text.trim(), 10)
    if (!isNaN(num) && num > 0) {
      let fixtureIds: string[] | null = session.displayed_fixtures || null
      if (!fixtureIds || fixtureIds.length === 0) {
        const today = new Date().toISOString().split('T')[0]
        const { data: todayFixtures } = await supabase
          .from('fixtures')
          .select('id, status')
          .eq('scheduled_date', today)
          .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
          .order('matchday', { ascending: true })
        fixtureIds = (todayFixtures as any[])?.map((f) => f.id) || null
      }

      if (fixtureIds && num <= fixtureIds.length) {
        const chosenId = fixtureIds[num - 1]
        const { data: chosenFixture } = await supabase
          .from('fixtures')
          .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), results!results_fixture_id_fkey(home_score, away_score)')
          .eq('id', chosenId)
          .single()

        if (chosenFixture) {
          const cf = chosenFixture as any
          const hName = (Array.isArray(cf.home_team) ? cf.home_team[0]?.name : cf.home_team?.name) || '?'
          const aName = (Array.isArray(cf.away_team) ? cf.away_team[0]?.name : cf.away_team?.name) || '?'
          console.log('[webhook] direct number select:', num, '→ fixture:', chosenId, hName, 'vs', aName)

          const isAlreadyConfirmed = isFixtureConfirmed(cf)

          await upsertSession({
            phone_number: from,
            matched_fixture_id: chosenId,
            home_team: session.home_team,
            away_team: session.away_team,
            home_score: session.home_score,
            away_score: session.away_score,
            match_stats: session.match_stats,
            state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
          })

          const statsBlock = formatStatsBlock(session.match_stats)
          const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
          const hint = '\n\nYour fixture isn\'t here? Type "check other date".'
          await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type CANCEL to start over.${hint}`, phoneNumberId)
          return
        }
      }
    }
  }

  // Text-based fixture matching: if user types a team name instead of a number
  if (session && session.home_score !== null && session.away_score !== null && !session.matched_fixture_id) {
    const lowerText = text.toLowerCase()
    if (lowerText.length > 3 && !/^(yes|yeah|yep|y|ok|okay|no|cancel|help)$/i.test(lowerText)) {
      const words = lowerText.split(/\s+/).filter((w: string) => w.length >= 2)
      if (words.length > 0) {
        let fixtureIds: string[] | null = session.displayed_fixtures || null
        if (!fixtureIds || fixtureIds.length === 0) {
          const today = new Date().toISOString().split('T')[0]
          const { data: todayFixtures } = await supabase
            .from('fixtures')
            .select('id, status')
            .eq('scheduled_date', today)
            .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
            .order('matchday', { ascending: true })
          fixtureIds = (todayFixtures as any[])?.map((f: any) => f.id) || null
        }

        if (fixtureIds && fixtureIds.length > 0) {
          const { data: candidateFixtures } = await supabase
            .from('fixtures')
            .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), results!results_fixture_id_fkey(home_score, away_score)')
            .in('id', fixtureIds)

          const matches = ((candidateFixtures as any[]) || []).filter((f: any) => {
            const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
            const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
            const combined = `${hName} vs ${aName}`
            return words.every((w: string) => combined.includes(w))
          })

          let finalMatches = matches
          if (finalMatches.length !== 1) {
            const oneTeamMatches = ((candidateFixtures as any[]) || []).filter((f: any) => {
              const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
              const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
              const input = lowerText.trim()
              return input.length >= 3 && (
                hName.includes(input) || input.includes(hName) ||
                aName.includes(input) || input.includes(aName)
              )
            })
            if (oneTeamMatches.length >= 1) finalMatches = oneTeamMatches
          }

          if (finalMatches.length === 1) {
            const chosen = finalMatches[0]
            const hName = fixtureTeamName(chosen, 'home')
            const aName = fixtureTeamName(chosen, 'away')
            console.log('[webhook] text matched fixture:', hName, 'vs', aName, 'words:', words)

            const isAlreadyConfirmed = isFixtureConfirmed(chosen)

            await upsertSession({
              phone_number: from,
              matched_fixture_id: chosen.id,
              home_team: session.home_team,
              away_team: session.away_team,
              home_score: session.home_score,
              away_score: session.away_score,
              match_stats: session.match_stats,
              state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
            })

            const statsBlock = formatStatsBlock(session.match_stats)
            const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
            const hint = '\n\nYour fixture isn\'t here? Type "check other date".'
            await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type CANCEL to start over.${hint}`, phoneNumberId)
            return
          } else if (finalMatches.length > 1) {
            const lines = finalMatches.map((f: any, i: number) => formatFixtureLine(f, i))
            await sendTextMessage(from, `Found ${finalMatches.length} matches, be more specific:\n\n${lines.join('\n')}\n\nReply with the number or type both team names.`, phoneNumberId)
            return
          }
        }
      }
    }
  }

  // LLM-based correction or confirmation (only for active result sessions)
  const context = buildConversationContext({
    userMessage: text,
    session,
    availableFixtures: null,
    isManager: true,
  })

  const intent = await conversationalReply(CAT_SYSTEM_PROMPT, context)

  switch (intent.intent) {
    case 'confirm': {
      if (!session) { await sendTextMessage(from, intent.reply, phoneNumberId); return }
      if (session.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
        if (session.state === 'awaiting_override_confirm') {
          await resetAndResubmit(from, session, supabase, phoneNumberId); return
        }
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
    default: { await sendTextMessage(from, intent.reply, phoneNumberId); return }
  }
}

// ─── Image handler ───────────────────────────────────────────────────────────────

async function handleImage(from: string, msg: { image: { id: string; mime_type: string } }, phoneNumberId: string) {
  await sendTextMessage(from, "Shot, let me take a look... \uD83D\uDC40", phoneNumberId)

  const imageId = msg.image.id
  const mediaUrl = await getMediaUrl(imageId)
  const { buffer: rawBuffer, mimeType } = await fetchImageBytes(mediaUrl)
  const buffer = await normalizeToLandscape(rawBuffer)
  console.log(`[webhook] downloaded ${rawBuffer.length} bytes, normalized to ${buffer.length} bytes`)

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

  if (!matchStats && ocrResult?.stats && Object.keys(ocrResult.stats).length > 0) {
    console.log('[webhook] using OCR parsed stats as fallback, count:', Object.keys(ocrResult.stats).length)
    matchStats = ocrResult.stats
  }

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
        if (geminiResult.homeScore != null && geminiResult.awayScore != null) {
          if (homeScore !== null && awayScore !== null &&
              (homeScore !== geminiResult.homeScore || awayScore !== geminiResult.awayScore)) {
            console.log(`[webhook] SCORE MISMATCH: text=${textScoreSource}(${homeScore}-${awayScore}) vs vision(${geminiResult.homeScore}-${geminiResult.awayScore}) — preferring vision`)
          }
          homeScore = geminiResult.homeScore; awayScore = geminiResult.awayScore
        }
        homeTeam = geminiResult.homeTeam || homeTeam; awayTeam = geminiResult.awayTeam || awayTeam
        if (!matchStats && geminiResult.matchStats) matchStats = geminiResult.matchStats
      }
    }
  } catch {}

  console.log('[webhook] final - team:', homeTeam, awayTeam, 'score:', homeScore, awayScore, 'source:', visionScoreSource || textScoreSource || 'none', 'statsKeys:', matchStats ? Object.keys(matchStats).join(',') : 'none')

  if (invalidReason) { await sendTextMessage(from, `Yoh, this doesn't look like a match result — ${invalidReason}.`, phoneNumberId); return }
  if (homeScore === null || awayScore === null) { await sendTextMessage(from, "Sorry, I couldn't read the scores. Send a screenshot of the Full Time result screen.", phoneNumberId); return }

  const supabase = await createAdminClient()

  const searchWords = [homeTeam, awayTeam]
    .filter(Boolean)
    .flatMap((name) => name!.toLowerCase().split(/\s+/))
    .filter((w) => w.length >= 2)

  const today = new Date().toISOString().split('T')[0]
  const { data: todayFixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
    .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
    .eq('scheduled_date', today).order('matchday')

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

  function fixtureMatchesOneTeamName(f: any): boolean {
    const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
    const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
    const homeInput = (homeTeam || '').toLowerCase().trim()
    const awayInput = (awayTeam || '').toLowerCase().trim()
    return (homeInput.length >= 3 && (hName.includes(homeInput) || homeInput.includes(hName) || aName.includes(homeInput) || homeInput.includes(aName))) ||
           (awayInput.length >= 3 && (hName.includes(awayInput) || awayInput.includes(hName) || aName.includes(awayInput) || awayInput.includes(aName)))
  }

  let matchedFixture: any = null
  if (searchWords.length > 0) {
    const keywordMatches = fixtures.filter(fixtureMatchesAllWords)
    if (keywordMatches.length === 1) {
      matchedFixture = keywordMatches[0]
    } else if (keywordMatches.length > 1) {
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

    if (!matchedFixture) {
      const oneTeamMatches = fixtures.filter(fixtureMatchesOneTeamName)
      if (oneTeamMatches.length === 1) {
        matchedFixture = oneTeamMatches[0]
      }
    }
  }

  if (matchedFixture) {
    const hName = fixtureTeamName(matchedFixture, 'home')
    const aName = fixtureTeamName(matchedFixture, 'away')

    const fixtureHomeLower = hName.toLowerCase()
    const fixtureAwayLower = aName.toLowerCase()
    const ocrHomeLower = (homeTeam || '').toLowerCase()
    const ocrAwayLower = (awayTeam || '').toLowerCase()

    const ocrHomeMatchesFixtureAway = ocrHomeLower && fixtureAwayLower && (fixtureAwayLower.includes(ocrHomeLower) || ocrHomeLower.includes(fixtureAwayLower))
    const ocrAwayMatchesFixtureHome = ocrAwayLower && fixtureHomeLower && (fixtureHomeLower.includes(ocrAwayLower) || ocrAwayLower.includes(fixtureHomeLower))

    if (ocrHomeMatchesFixtureAway && ocrAwayMatchesFixtureHome) {
      console.log(`[webhook] AUTO-SWAP: (${homeTeam}/${homeScore} - ${awayTeam}/${awayScore}) flipped vs (${hName} vs ${aName})`)
      const tmpScore = homeScore; homeScore = awayScore; awayScore = tmpScore
      const tmpTeam = homeTeam; homeTeam = awayTeam; awayTeam = tmpTeam
      if (matchStats) {
        const swapped: Record<string, { home: number; away: number }> = {}
        for (const [key, val] of Object.entries(matchStats)) {
          swapped[key] = { home: val.away, away: val.home }
        }
        matchStats = swapped
      }
    }

    const isAlreadyConfirmed = isFixtureConfirmed(matchedFixture)

    await upsertSession({
      phone_number: from,
      home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
      match_stats: matchStats, matched_fixture_id: matchedFixture.id, screenshot_media_id: imageId,
      state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
    })

    const statsBlock = formatStatsBlock(matchStats)
    const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
    const hint = '\n\nYour fixture isn\'t here? Type "check other date".'
    console.log('[webhook] keyword matched fixture:', hName, 'vs', aName, 'words:', searchWords)
    await sendTextMessage(from, `Confirm result: ${hName} ${homeScore}-${awayScore} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type CANCEL to start over.${hint}`, phoneNumberId)
    return
  }

  let displayFixtures = fixtures
  if (searchWords.length > 0) {
    const partialMatches = fixtures.filter(fixtureMatchesOneTeamName)
    if (partialMatches.length > 0) {
      displayFixtures = partialMatches
    } else {
      const anyWordMatches = fixtures.filter(fixtureMatchesAnyWord)
      if (anyWordMatches.length > 0) displayFixtures = anyWordMatches
    }
  }

  await upsertSession({
    phone_number: from,
    home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
    match_stats: matchStats, matched_fixture_id: null, screenshot_media_id: imageId,
    displayed_fixtures: displayFixtures.map((f: any) => f.id),
  })

  if (displayFixtures.length > 0) {
    const lines = displayFixtures.map((f: any, i: number) => formatFixtureLine(f, i))
    const intro = searchWords.length > 0
      ? `Couldn't auto-match exactly, but here are fixtures involving ${homeTeam || '?'} or ${awayTeam || '?'}:`
      : "Couldn't auto-match. Today's fixtures:"
    await sendTextMessage(from, `${intro}\n\n${lines.join('\n')}\n\nReply with the number of your match. Type CANCEL to start over.\n\nYour fixture isn't here? Type "check other date".`, phoneNumberId)
  } else {
    await sendTextMessage(from, `No fixtures found for today. Your result has been saved — contact an admin to match it.`, phoneNumberId)
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

  const { error: rcErr } = await supabase
    .from('result_confirmations')
    .insert({
      fixture_id: session.matched_fixture_id,
      home_score: session.home_score,
      away_score: session.away_score,
      submitted_by: adminUserId,
    })
  if (rcErr) console.error('[webhook] confirmations insert failed:', rcErr.message)

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
  if (resultErr || !resultRow) {
    console.error('[webhook] results upsert failed:', resultErr?.message ?? 'no row returned')
    await clearSession(from)
    await sendTextMessage(from, 'Failed to save the result. Please try again or ask the admin to submit via the dashboard.', phoneNumberId)
    return
  }

  const dbStats = matchStatsToDbColumns(session.match_stats)
  if (resultRow?.id && dbStats) {
    const { error: statsErr } = await supabase
      .from('match_stats')
      .upsert({ result_id: resultRow.id, ...dbStats }, { onConflict: 'result_id' })
    if (statsErr) console.error('[webhook] match_stats insert failed:', statsErr.message)
    else console.log('[webhook] match_stats written for result:', resultRow.id)
  }

  // Verify fixture was confirmed by the on_result_insert trigger (migration 003)
  const { data: verifyFixture } = await supabase
    .from('fixtures')
    .select('status')
    .eq('id', session.matched_fixture_id)
    .single()

  if (verifyFixture?.status !== 'confirmed') {
    // Fallback: try explicit update
    const { error: fixtureErr } = await supabase
      .from('fixtures')
      .update({ status: 'confirmed' })
      .eq('id', session.matched_fixture_id)
    if (fixtureErr) {
      console.error('[webhook] fixture status update failed:', fixtureErr.message)
      await clearSession(from)
      await sendTextMessage(from, 'Result was saved but failed to confirm the fixture. Please ask the admin to re-submit.', phoneNumberId)
      return
    }
  }

  console.log('[webhook] result written:', { fixture_id: session.matched_fixture_id, home_score: session.home_score, away_score: session.away_score, submitted_by: adminUserId })
  await clearSession(from)
  await sendTextMessage(from, 'Result submitted!\n\nCheck your standings here: https://efa-fxyk.vercel.app/standings', phoneNumberId)

  // Send push notification to admin
  if (adminUserId) {
    try {
      const { data: fixture } = await supabase
        .from('fixtures')
        .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
        .eq('id', session.matched_fixture_id)
        .single()
      if (fixture) {
        const hName = ((Array.isArray(fixture.home_team) ? fixture.home_team[0]?.name : fixture.home_team?.name) || 'Home')
        const aName = ((Array.isArray(fixture.away_team) ? fixture.away_team[0]?.name : fixture.away_team?.name) || 'Away')
        await sendPushToUsers(supabase, [adminUserId], {
          title: 'Result Confirmed',
          body: `${hName} ${session.home_score}–${session.away_score} ${aName}`,
          url: `/fixtures/${session.matched_fixture_id}`,
          tag: `result-${session.matched_fixture_id}`,
        })
      }
    } catch (e) {
      console.error('[webhook] admin push notification failed:', e)
    }
  }
}

// ─── Reset & re-submit (override flow) ──────────────────────────────────────

const MAX_WHATSAPP_RESETS = 2

async function resetAndResubmit(from: string, session: SessionData, supabase: any, phoneNumberId: string) {
  if (!session.matched_fixture_id || session.home_score === null || session.away_score === null) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong.', phoneNumberId)
    return
  }

  // Check reset limit
  const { data: fixtureRow } = await supabase
    .from('fixtures')
    .select('tournament_id, whatsapp_reset_count')
    .eq('id', session.matched_fixture_id)
    .single()

  if (!fixtureRow) {
    await clearSession(from)
    await sendTextMessage(from, 'Fixture not found. Please try again.', phoneNumberId)
    return
  }

  if ((fixtureRow.whatsapp_reset_count || 0) >= MAX_WHATSAPP_RESETS) {
    console.log('[webhook] reset limit reached for fixture:', session.matched_fixture_id)
    await clearSession(from)
    await sendTextMessage(from, 'This match has already been reset twice. Contact admin at 0732509506 for further assistance.', phoneNumberId)
    return
  }

  console.log('[webhook] resetting fixture:', session.matched_fixture_id, 'reset count:', (fixtureRow.whatsapp_reset_count || 0) + 1)

  // 1. Delete match_stats for the existing result
  const { data: existingResult } = await supabase
    .from('results')
    .select('id')
    .eq('fixture_id', session.matched_fixture_id)
    .maybeSingle()

  if (existingResult) {
    await supabase.from('match_stats').delete().eq('result_id', existingResult.id)
    await supabase.from('results').delete().eq('id', existingResult.id)
  }

  // 2. Delete confirmations
  await supabase.from('result_confirmations').delete().eq('fixture_id', session.matched_fixture_id)

  // 3. Reset fixture status + increment reset count
  await supabase
    .from('fixtures')
    .update({ status: 'scheduled', whatsapp_reset_count: (fixtureRow.whatsapp_reset_count || 0) + 1 })
    .eq('id', session.matched_fixture_id)

  // 4. Recalculate standings
  try {
    await recalculateStandings(fixtureRow.tournament_id)
  } catch (e) {
    console.error('[webhook] standings recalc failed during reset:', e)
  }

  // 5. Re-submit with the new result
  await writeResultToDb(from, session, supabase, phoneNumberId)
}
