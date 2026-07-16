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
    console.log(`[webhook] from=${from} type=${msg.type} count=${messages.length}`)

    // Handle multiple images: find the first one with a valid score
    const imageMessages = messages.filter((m: any) => m.type === 'image')
    if (imageMessages.length > 1) {
      console.log(`[webhook] ${imageMessages.length} images received, scanning for valid score...`)
      let winner: any = null
      for (const imgMsg of imageMessages) {
        try {
          const mediaUrl = await getMediaUrl(imgMsg.image.id)
          const { buffer: rawBuf, mimeType } = await fetchImageBytes(mediaUrl)
          const buffer = await normalizeToLandscape(rawBuf)
          const analysis = await analyzeImageBuffer(buffer, mimeType)
          if (!analysis.invalidReason && analysis.homeScore !== null && analysis.awayScore !== null) {
            winner = imgMsg
            console.log(`[webhook] found valid score in image ${imgMsg.image.id}: ${analysis.homeScore}-${analysis.awayScore}`)
            break
          }
        } catch {}
      }
      if (winner) {
        await handleImage(from, winner, phoneNumberId)
      } else {
        await sendTextMessage(from, "I couldn't analyse the image. Send to the group.", phoneNumberId)
      }
    } else if (msg.type === 'image') {
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

// ─── Backdoor admin flow ──────────────────────────────────────────────────────

async function handleBackdoorDate(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const parsed = parseUserDate(text)
  if (!parsed) {
    await sendTextMessage(from, "Couldn't parse that date. Try \"12 Jul\", \"July 12\", or \"2026-07-12\".", phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('fixtures')
    .select('id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('scheduled_date', parsed.dateKey)
    .eq('status', 'scheduled')
    .order('matchday', { ascending: true })

  const fixtures = (data as any[]) || []
  if (fixtures.length === 0) {
    await sendTextMessage(from, `No unconfirmed fixtures for ${parsed.dateKey}.`, phoneNumberId)
    await clearSession(from)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_fixture',
    pending_date: parsed.dateKey,
    displayed_fixtures: fixtures.map((f: any) => f.id),
  })

  const lines = fixtures.map((f: any, i: number) => `${i + 1}. ${fixtureTeamName(f, 'home')} vs ${fixtureTeamName(f, 'away')}`)
  await sendTextMessage(from, `Fixtures for ${parsed.dateKey}:\n\n${lines.join('\n')}\n\nReply with the number. Type CANCEL to abort.`, phoneNumberId)
}

async function handleBackdoorFixture(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const session = await getSession(from)
  if (!session?.displayed_fixtures) {
    await clearSession(from)
    await sendTextMessage(from, "Something went wrong. Start over.", phoneNumberId)
    return
  }
  const num = parseInt(text.trim(), 10)
  if (isNaN(num) || num < 1 || num > session.displayed_fixtures.length) {
    await sendTextMessage(from, `Pick a number between 1 and ${session.displayed_fixtures.length}.`, phoneNumberId)
    return
  }
  const fixtureId = session.displayed_fixtures[num - 1]
  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_side',
    matched_fixture_id: fixtureId,
  })

  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('id', fixtureId)
    .single()
  const h = fixtureTeamName(data, 'home')
  const a = fixtureTeamName(data, 'away')
  await sendTextMessage(from, `${h} vs ${a}\n\nWho gets the 3-0 win? Reply "home" or "away". Type CANCEL to abort.`, phoneNumberId)
}

async function handleBackdoorSide(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const session = await getSession(from)
  if (!session?.matched_fixture_id) {
    await clearSession(from)
    await sendTextMessage(from, "Something went wrong. Start over.", phoneNumberId)
    return
  }
  const lower = text.trim().toLowerCase()
  let homeScore: number, awayScore: number
  if (/^home$/i.test(lower)) { homeScore = 3; awayScore = 0 }
  else if (/^away$/i.test(lower)) { homeScore = 0; awayScore = 3 }
  else { await sendTextMessage(from, "Reply \"home\" or \"away\".", phoneNumberId); return }

  const supabase = await createAdminClient()
  const adminUserId = await getAdminUserId(supabase)

  await supabase.from('result_confirmations').insert({
    fixture_id: session.matched_fixture_id,
    home_score: homeScore,
    away_score: awayScore,
    submitted_by: adminUserId,
  })

  await supabase.from('results').upsert({
    fixture_id: session.matched_fixture_id,
    home_score: homeScore,
    away_score: awayScore,
    ...(adminUserId ? { finalised_by: adminUserId } : {}),
  }, { onConflict: 'fixture_id' })

  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', session.matched_fixture_id)

  await clearSession(from)
  await sendTextMessage(from, "Backdoor win submitted.", phoneNumberId)
}

// ─── Forfeit flow ───────────────────────────────────────────────────────────

async function handleForfeitYes(from: string, session: SessionData, supabase: any, phoneNumberId: string) {
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('id', session.matched_fixture_id)
    .single()
  if (!fixture) {
    await sendTextMessage(from, "Couldn't find fixture. Reply yes or no.", phoneNumberId)
    return
  }

  const hName = fixtureTeamName(fixture, 'home')
  const aName = fixtureTeamName(fixture, 'away')
  const hScore = session.home_score!
  const aScore = session.away_score!

  let newHomeScore = hScore
  let newAwayScore = aScore
  if (hScore > aScore) newHomeScore = hScore + 3
  else newAwayScore = aScore + 3

  await upsertSession({
    phone_number: from,
    state: 'awaiting_forfeit_confirm',
    home_score: newHomeScore,
    away_score: newAwayScore,
    pending_date: `${hScore}:${aScore}`,
  })

  await sendTextMessage(from, `Forfeit applied. Confirm result: ${hName} ${newHomeScore}-${newAwayScore} ${aName} (forfeited)?\n\nReply YES to submit. Type CANCEL to abort.`, phoneNumberId)
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

  // ─── Backdoor admin flow ──────────────────────────────────────────────────
  if (session?.state === 'awaiting_backdoor_date') {
    await handleBackdoorDate(from, text, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_backdoor_fixture') {
    await handleBackdoorFixture(from, text, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_backdoor_side') {
    await handleBackdoorSide(from, text, phoneNumberId)
    return
  }
  if (/^backdoor$/i.test(text.trim())) {
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor_date' })
    await sendTextMessage(from, "Enter the fixture date.", phoneNumberId)
    return
  }
  // ─── Match name search (after screenshot) ────────────────────────────────
  if (session?.state === 'awaiting_match_name') {
    if (/^cancel$/i.test(text.trim())) {
      await clearSession(from)
      await sendTextMessage(from, "No stress. Send a new screenshot when you're ready.", phoneNumberId)
      return
    }
    const supabase = await createAdminClient()
    const searchInput = text.trim()

    const vsParts = searchInput.split(/\s+vs\.?\s+|\s+-\s+/i)
    let teamSearches: string[]
    if (vsParts.length >= 2) {
      teamSearches = [vsParts[0].trim().toLowerCase(), vsParts.slice(1).join(' - ').trim().toLowerCase()]
    } else {
      teamSearches = [searchInput.toLowerCase().trim()]
    }
    teamSearches = teamSearches.filter((s: string) => s.length >= 2)

    if (teamSearches.length === 0) {
      await sendTextMessage(from, "Please type at least one team name. Type CANCEL to start over.", phoneNumberId)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: fixtures } = await supabase
      .from('fixtures')
      .select('id, home_team_id, away_team_id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
      .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
      .gte('scheduled_date', sevenDaysAgo)
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: false })
      .order('matchday')

    const allFixtures = (fixtures as any[]) || []

    const TEAM_ALIASES: Record<string, string> = {
      'utd': 'united', 'man utd': 'manchester united', 'man u': 'manchester united',
      'barca': 'barcelona',
      'inter': 'internazionale milan', 'inter milan': 'internazionale milan',
      'acm': 'ac milan', 'ac m': 'ac milan',
      'rma': 'real madrid', 'bvb': 'borussia dortmund',
      'psg': 'paris saint germain', 'bayern': 'bayern munchen',
      'lfc': 'liverpool', 'mcfc': 'manchester city', 'mufc': 'manchester united',
      'afc': 'arsenal', 'cfc': 'chelsea',
    }

    function expandAlias(token: string): string {
      return TEAM_ALIASES[token] || token
    }

    function levenshtein(a: string, b: string): number {
      const m = a.length, n = b.length
      const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])
      for (let i = 0; i <= m; i++) dp[i][0] = i
      for (let j = 0; j <= n; j++) dp[0][j] = j
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
      }
      return dp[m][n]
    }

    function tokenScore(searchToken: string, teamToken: string): number {
      const s = expandAlias(searchToken)
      const t = expandAlias(teamToken)
      if (s === t) return 1.0
      if (t.includes(s) || s.includes(t)) return 0.9
      if (t.startsWith(s) || s.startsWith(t)) return 0.85
      const dist = levenshtein(s, t)
      const maxLen = Math.max(s.length, t.length)
      if (maxLen <= 2) return dist === 0 ? 1.0 : 0
      if (dist <= 2) return 0.7
      return 0
    }

    function teamNameScore(search: string, teamName: string): number {
      const searchTokens = search.split(/\s+/).filter((w: string) => w.length >= 2)
      const teamTokens = teamName.split(/\s+/).filter((w: string) => w.length >= 2)
      if (searchTokens.length === 0 || teamTokens.length === 0) return 0
      let totalScore = 0
      for (const st of searchTokens) {
        let best = 0
        for (const tt of teamTokens) {
          best = Math.max(best, tokenScore(st, tt))
        }
        totalScore += best
      }
      return totalScore / searchTokens.length
    }

    function fixtureMatches(f: any): boolean {
      const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
      const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
      if (teamSearches.length === 2) {
        const s1 = teamSearches[0], s2 = teamSearches[1]
        const score1 = Math.max(teamNameScore(s1, hName) + teamNameScore(s2, aName),
                                teamNameScore(s1, aName) + teamNameScore(s2, hName)) / 2
        return score1 >= 0.7
      }
      return teamNameScore(teamSearches[0], hName) >= 0.7 || teamNameScore(teamSearches[0], aName) >= 0.7
    }

    const matchedFixtures = allFixtures.filter(fixtureMatches)

    if (matchedFixtures.length === 0) {
      await sendTextMessage(from, `No fixtures found matching "${searchInput}". Try different team names or type CANCEL.`, phoneNumberId)
      return
    }

    if (matchedFixtures.length === 1) {
      const f = matchedFixtures[0]
      const hName = fixtureTeamName(f, 'home')
      const aName = fixtureTeamName(f, 'away')
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      const isAlreadyConfirmed = isFixtureConfirmed(f)

      await upsertSession({
        phone_number: from,
        matched_fixture_id: f.id,
        state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
        displayed_fixtures: null,
      })

      const resultLine = result && (f.status === 'confirmed' || f.status === 'awaiting_confirmation')
        ? ` (already submitted: ${result.home_score}-${result.away_score})`
        : ''
      const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
      const statsBlock = formatStatsBlock(session.match_stats)
      await sendTextMessage(from, `Found: ${hName} vs ${aName}${resultLine}\n\nConfirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.`, phoneNumberId)
      return
    }

    // Multiple matches — show numbered list
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixture_from_past',
      displayed_fixtures: matchedFixtures.map((f: any) => f.id),
    })

    const lines = matchedFixtures.map((f: any, i: number) => formatFixtureLine(f, i))
    await sendTextMessage(from, `Found ${matchedFixtures.length} matches:\n\n${lines.join('\n')}\n\nReply with the number of your match. Type CANCEL to start over.`, phoneNumberId)
    return
  }

  // Only reject users who have no active session at all (never sent a screenshot)
  if (!session || (session.home_score === null && session.away_score === null)) {
    await sendTextMessage(from, "I only help with submitting match results. Send a screenshot of your result screen and I'll take it from there.", phoneNumberId)
    return
  }

  const supabase = await createAdminClient()

  // Forfeit question: did the losing team forfeit?
  if (session?.state === 'awaiting_forfeit') {
    const lower = text.trim().toLowerCase()
    if (/^(yes|yeah|yep|y|ja)$/i.test(lower)) {
      await handleForfeitYes(from, session, supabase, phoneNumberId)
      return
    }
    if (/^(no|nah|nope|n)$/i.test(lower)) {
      await upsertSession({ phone_number: from, state: 'idle' })
      console.log('[webhook] user declined forfeit, writing to DB')
      const { data: fixCheck } = await supabase
        .from('fixtures')
        .select('status')
        .eq('id', session.matched_fixture_id)
        .single()
      if (fixCheck && (fixCheck.status === 'confirmed' || fixCheck.status === 'awaiting_confirmation')) {
        await resetAndResubmit(from, session, supabase, phoneNumberId)
      } else {
        await writeResultToDb(from, session, supabase, phoneNumberId)
      }
      return
    }
    await sendTextMessage(from, "Reply yes or no.", phoneNumberId)
    return
  }

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
      // Override flow: ask about forfeit first, then reset + re-submit
      if (session.state === 'awaiting_override_confirm') {
        await upsertSession({ phone_number: from, state: 'awaiting_forfeit' })
        await sendTextMessage(from, "Did the losing team forfeit before the game finished? Reply yes or no.", phoneNumberId)
        return
      }
      // Forfeit confirm: user confirmed the forfeit-adjusted score
      if (session.state === 'awaiting_forfeit_confirm') {
        console.log('[webhook] forfeit confirmed by user, writing to DB')
        await upsertSession({ phone_number: from, state: 'idle' })
        const { data: fixCheck2 } = await supabase
          .from('fixtures')
          .select('status')
          .eq('id', session.matched_fixture_id)
          .single()
        if (fixCheck2 && (fixCheck2.status === 'confirmed' || fixCheck2.status === 'awaiting_confirmation')) {
          await resetAndResubmit(from, session, supabase, phoneNumberId)
        } else {
          await writeResultToDb(from, session, supabase, phoneNumberId)
        }
        return
      }
      // First confirmation: ask about forfeit before writing to DB
      if (!session.displayed_fixtures || session.displayed_fixtures.length === 0) {
        await upsertSession({ phone_number: from, state: 'awaiting_forfeit' })
        await sendTextMessage(from, "Did the losing team forfeit before the game finished? Reply yes or no.", phoneNumberId)
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
      await sendTextMessage(from, `Sides swapped!\n\nConfirm result: ${newHome} ${newHomeScore}-${newAwayScore} ${newAway}?${statsBlock ? '\n\n' + statsBlock : ''}\n\nType SWAP if stats are still on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start again.`, phoneNumberId)
      return
    }
    // EDIT SCORE — override the score for aggregate/replay situations
    if (/^(edit\s*score|score)$/i.test(lower)) {
      await upsertSession({ phone_number: from, state: 'awaiting_edit_score' })
      await sendTextMessage(from, "What is the correct aggregate score? Type it as: 3-2", phoneNumberId)
      return
    }
  }

  // ─── Edit score: user types new score ──────────────────────────────────────
  if (session?.state === 'awaiting_edit_score') {
    const match = text.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/)
    if (!match) {
      await sendTextMessage(from, "Please type the score as: 3-2", phoneNumberId)
      return
    }
    const newHomeScore = parseInt(match[1], 10)
    const newAwayScore = parseInt(match[2], 10)

    const { data: fixCheck } = await supabase
      .from('fixtures')
      .select('status')
      .eq('id', session.matched_fixture_id)
      .single()
    const wasOverride = fixCheck && (fixCheck.status === 'confirmed' || fixCheck.status === 'awaiting_confirmation')

    await upsertSession({
      phone_number: from,
      home_score: newHomeScore,
      away_score: newAwayScore,
      state: wasOverride ? 'awaiting_override_confirm' : 'idle',
    })

    const statsBlock = formatStatsBlock(session.match_stats)
    const overrideWarning = wasOverride ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
    await sendTextMessage(from, `Score updated!\n\nConfirm result: ${session.home_team} ${newHomeScore}-${newAwayScore} ${session.away_team}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.`, phoneNumberId)
    return
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
          displayed_fixtures: null,
          state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
        })

        await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.\n\nYour fixture isn't here? Type "check other date".`, phoneNumberId)
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
            displayed_fixtures: null,
            state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
          })

          const statsBlock = formatStatsBlock(session.match_stats)
          const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
          const hint = '\n\nYour fixture isn\'t here? Type "check other date".'
          await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.${hint}`, phoneNumberId)
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
              displayed_fixtures: null,
              state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
            })

            const statsBlock = formatStatsBlock(session.match_stats)
            const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
            const hint = '\n\nYour fixture isn\'t here? Type "check other date".'
            await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.${hint}`, phoneNumberId)
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

// ─── Image analysis helper (no side effects) ───────────────────────────────

type ImageAnalysis = {
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  matchStats: Record<string, { home: number; away: number }> | null
  invalidReason: string | null
}

async function analyzeImageBuffer(buffer: Buffer, mimeType: string): Promise<ImageAnalysis> {
  let ocrResult: Awaited<ReturnType<typeof parseScreenshot>> | null = null
  try { ocrResult = await parseScreenshot(buffer) } catch {}

  let homeTeam: string | null = null, awayTeam: string | null = null
  let homeScore: number | null = null, awayScore: number | null = null
  let matchStats: Record<string, { home: number; away: number }> | null = null
  let invalidReason: string | null = null

  if (ocrResult?.rawText) {
    try {
      const cleaned = await cleanOcrText(ocrResult.rawText)
      if (cleaned) {
        if (cleaned.valid === false) invalidReason = cleaned.reason || null
        else { homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats }
      }
    } catch {
      try {
        const cleaned = await cleanOcrWithGroq(ocrResult.rawText)
        if (cleaned) {
          if (cleaned.valid === false) invalidReason = cleaned.reason || null
          else { homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats }
        }
      } catch {}
    }
  }

  if (homeScore === null && ocrResult) {
    homeScore = ocrResult.homeScore || null; awayScore = ocrResult.awayScore || null
    homeTeam = homeTeam || ocrResult.homeTeamOcr || null; awayTeam = awayTeam || ocrResult.awayTeamOcr || null
  }

  if (!matchStats && ocrResult?.stats && Object.keys(ocrResult.stats).length > 0) {
    matchStats = ocrResult.stats
  }

  try {
    const geminiResult = await analyzeScreenshot(buffer, mimeType)
    if (geminiResult) {
      if (geminiResult.valid === false) {
        if (!invalidReason) invalidReason = geminiResult.reason || null
      } else {
        if (geminiResult.homeScore != null && geminiResult.awayScore != null) {
          homeScore = geminiResult.homeScore; awayScore = geminiResult.awayScore
        }
        homeTeam = geminiResult.homeTeam || homeTeam; awayTeam = geminiResult.awayTeam || awayTeam
        if (!matchStats && geminiResult.matchStats) matchStats = geminiResult.matchStats
      }
    }
  } catch {}

  return { homeTeam, awayTeam, homeScore, awayScore, matchStats, invalidReason }
}

// ─── Image handler ───────────────────────────────────────────────────────────────

async function handleImage(from: string, msg: { image: { id: string; mime_type: string } }, phoneNumberId: string) {
  await sendTextMessage(from, "Shot, let me take a look... \uD83D\uDC40", phoneNumberId)

  const imageId = msg.image.id
  const mediaUrl = await getMediaUrl(imageId)
  const { buffer: rawBuffer, mimeType } = await fetchImageBytes(mediaUrl)
  const buffer = await normalizeToLandscape(rawBuffer)
  console.log(`[webhook] downloaded ${rawBuffer.length} bytes, normalized to ${buffer.length} bytes`)

  const analysis = await analyzeImageBuffer(buffer, mimeType)
  const homeTeam = analysis.homeTeam
  const awayTeam = analysis.awayTeam
  const matchStats = analysis.matchStats
  const invalidReason = analysis.invalidReason
  const homeScore = analysis.homeScore
  const awayScore = analysis.awayScore

  console.log('[webhook] final - team:', homeTeam, awayTeam, 'score:', homeScore, awayScore, 'statsKeys:', matchStats ? Object.keys(matchStats).join(',') : 'none')

  if (invalidReason) { await sendTextMessage(from, "I couldn't analyse the image. Send to the group.", phoneNumberId); return }
  if (homeScore === null || awayScore === null) { await sendTextMessage(from, "I couldn't analyse the image. Send to the group.", phoneNumberId); return }

  await upsertSession({
    phone_number: from,
    home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
    match_stats: matchStats, matched_fixture_id: null, screenshot_media_id: imageId,
    state: 'awaiting_match_name',
  })

  await sendTextMessage(from, `Score extracted: ${homeTeam || '?'} ${homeScore}-${awayScore} ${awayTeam || '?'}\n\nWhat match is this for? Type the team names, e.g. "Arsenal vs Everton". Type CANCEL to start over.`, phoneNumberId)
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

  const isForfeitConfirm = session.state === 'awaiting_forfeit_confirm'
  const adminUserId = await getAdminUserId(supabase)
  console.log('[webhook] admin user celemqhele id:', adminUserId || 'NOT FOUND')

  // Look up fixture for team IDs
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('id', session.matched_fixture_id)
    .single()

  let homeScore = session.home_score
  let awayScore = session.away_score
  let forfeitBalanceNote = ''

  // Forfeit balance aggregate: check if either team has active forfeit balances
  if (fixture?.home_team_id && fixture?.away_team_id && homeScore !== awayScore) {
    const losingTeamId = homeScore < awayScore ? fixture.home_team_id : fixture.away_team_id
    const { data: balances } = await supabase
      .from('forfeit_balances')
      .select('id, opponent_score, forfeiting_team:teams!forfeit_balances_forfeiting_team_id_fkey(name), opponent_team:teams!forfeit_balances_opponent_team_id_fkey(name)')
      .eq('forfeiting_team_id', losingTeamId)
      .gt('remaining', 0)

    if (balances && balances.length > 0) {
      let totalForfeitGoals = 0
      for (const bal of balances) {
        totalForfeitGoals += bal.opponent_score
        await supabase.from('forfeit_balances').update({ remaining: 0 }).eq('id', bal.id)
      }
      if (homeScore < awayScore) homeScore += totalForfeitGoals
      else awayScore += totalForfeitGoals

      const teamName = (Array.isArray(balances[0]?.forfeiting_team) ? balances[0].forfeiting_team[0]?.name : balances[0]?.forfeiting_team?.name) || 'Team'
      const oppName = (Array.isArray(balances[0]?.opponent_team) ? balances[0].opponent_team[0]?.name : balances[0]?.opponent_team?.name) || 'Opponent'
      forfeitBalanceNote = `\n\nForfeit balance applied: ${teamName} had ${balances.length} active forfeit balance(s) from ${oppName} (${balances[0].opponent_score} goals). Adjusted to ${homeScore}-${awayScore}.`
      console.log('[webhook] forfeit balance applied:', teamName, '+', totalForfeitGoals, 'goals')
    }
  }

  // Insert result_confirmations
  const { error: rcErr } = await supabase
    .from('result_confirmations')
    .insert({
      fixture_id: session.matched_fixture_id,
      home_score: homeScore,
      away_score: awayScore,
      submitted_by: adminUserId,
    })
  if (rcErr) console.error('[webhook] confirmations insert failed:', rcErr.message)

  // Upsert result
  const { data: resultRow, error: resultErr } = await supabase
    .from('results')
    .upsert({
      fixture_id: session.matched_fixture_id,
      home_score: homeScore,
      away_score: awayScore,
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

  // If this was a forfeit confirmation, mark result as abandoned and create forfeit_balances entry
  if (isForfeitConfirm && fixture) {
    const [origHomeScore, origAwayScore] = (session.pending_date || '').split(':').map(Number)
    const homeForfeit = (origHomeScore || 0) < (origAwayScore || 0)
    const awayForfeit = (origAwayScore || 0) < (origHomeScore || 0)
    const abandonedType = homeForfeit ? 'home' : awayForfeit ? 'away' : null

    if (abandonedType) {
      await supabase
        .from('results')
        .update({ is_abandoned: true, abandoned_type: abandonedType })
        .eq('id', resultRow.id)

      const forfTeamId = homeForfeit ? fixture.home_team_id : fixture.away_team_id
      const oppTeamId = homeForfeit ? fixture.away_team_id : fixture.home_team_id
      await supabase.from('forfeit_balances').insert({
        fixture_id: session.matched_fixture_id,
        forfeiting_team_id: forfTeamId,
        opponent_team_id: oppTeamId,
        opponent_score: homeForfeit ? origAwayScore : origHomeScore,
        forfeiting_score: homeForfeit ? origHomeScore : origAwayScore,
        half_time_note: `Forfeit: ${homeScore}-${awayScore} (adjusted from ${origHomeScore}-${origAwayScore})`,
      })

      // Recalculate standings since trigger double-counts on UPDATE
      const { data: fixData } = await supabase.from('fixtures').select('tournament_id').eq('id', session.matched_fixture_id).single()
      if (fixData?.tournament_id) {
        try { await recalculateStandings(fixData.tournament_id) } catch (e) { console.error('[webhook] standings recalc after forfeit failed:', e) }
      }
      console.log('[webhook] forfeit recorded:', abandonedType, 'for fixture:', session.matched_fixture_id)
    }
  }

  // Match stats
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

  console.log('[webhook] result written:', { fixture_id: session.matched_fixture_id, home_score: homeScore, away_score: awayScore, submitted_by: adminUserId })
  await clearSession(from)
  await sendTextMessage(from, `Result submitted!${forfeitBalanceNote}\n\nCheck your standings here: https://efa-fxyk.vercel.app/standings`, phoneNumberId)

  // Send push notification to admin
  if (adminUserId) {
    try {
      const { data: fixturePush } = await supabase
        .from('fixtures')
        .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
        .eq('id', session.matched_fixture_id)
        .single()
      if (fixturePush) {
        const hName = ((Array.isArray(fixturePush.home_team) ? fixturePush.home_team[0]?.name : fixturePush.home_team?.name) || 'Home')
        const aName = ((Array.isArray(fixturePush.away_team) ? fixturePush.away_team[0]?.name : fixturePush.away_team?.name) || 'Away')
        await sendPushToUsers(supabase, [adminUserId], {
          title: 'Result Confirmed',
          body: `${hName} ${homeScore}–${awayScore} ${aName}`,
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
