import { NextRequest, NextResponse } from 'next/server'
import {
  getMediaUrl,
  fetchImageBytes,
  normalizeToLandscape,
  sendTextMessage,
  sendContactMessage,
  analyzeScreenshot,
  cleanOcrText,
  cleanOcrWithGroq,
  conversationalReply,
  resolveTeamNameWithLLM,
} from '@/lib/whatsapp'

import { parseScreenshot } from '@/lib/screenshot-parser'
import { createAdminClient } from '@/lib/supabase/server'
import { CAT_SYSTEM_PROMPT, buildConversationContext, formatStatsBlock } from '@/lib/system-prompt'
import { sendPushToUsers } from '@/lib/push'
import { notifyBackdoorSubmitted, notifyBackdoorDecision } from '@/lib/backdoor-notify'
import { parseUserDate } from '@/lib/date-parser'
import { recalculateStandings } from '@/lib/standings-engine'

// ─── Date range helper: Last Sunday to Next Sunday (inclusive) ─────────────────────
function getSundayRange(): { start: string; end: string } {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday
  const daysSinceSunday = dayOfWeek === 0 ? 0 : dayOfWeek
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - daysSinceSunday)
  const nextSunday = new Date(lastSunday)
  nextSunday.setDate(lastSunday.getDate() + 7)
  return {
    start: lastSunday.toISOString().split('T')[0],
    end: nextSunday.toISOString().split('T')[0]
  }
}

// ─── Date range helper: Last 7 days to Next 7 days (inclusive) ─────────────────────
function getWeekRange(): { start: string; end: string } {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 7)
  const end = new Date(today)
  end.setDate(today.getDate() + 7)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

// ─── Admin phone numbers ──────────────────────────────────────────────────────────
const ADMIN_PHONES = ['+27678721810', '+27732509506', '+27734776081']
function isAdminPhone(phone: string): boolean {
  const norm = phone.replace(/\D/g, '')
  return ADMIN_PHONES.some(p => p.replace(/\D/g, '') === norm)
}

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
    const messageId = msg.id
    const from = msg.from as string
    const phoneNumberId = metadata?.phone_number_id as string
    
    // Deduplicate messages - WhatsApp can deliver same message multiple times.
    // Atomic: rely on the UNIQUE constraint on message_id; a race between two
    // deliveries of the same message must result in only one winning the INSERT.
    const supabaseCheck = await createAdminClient()

    // Gracefully handle missing processed_messages table
    try {
      const { error } = await supabaseCheck
        .from('processed_messages')
        .insert({ message_id: messageId, created_at: new Date().toISOString() })
      if (error?.code === '23505') {
        console.log(`[webhook] Duplicate message ignored: ${messageId}`)
        return new NextResponse(null, { status: 200 })
      }
      if (error) {
        console.log('[webhook] processed_messages dedup insert error:', error)
      }
    } catch (e) {
      console.log('[webhook] processed_messages table not available, skipping dedup:', e)
    }
    
    console.log(`[webhook] from=${from} type=${msg.type} count=${messages.length} msgId=${messageId}`)

    // Check maintenance mode
    const { data: maintenance } = await supabaseCheck
      .from('maintenance_mode')
      .select('enabled, message')
      .maybeSingle()
    
    if (maintenance?.enabled) {
      // Check if admin command to disable maintenance
      const text = msg.type === 'text' ? (msg.text?.body || '').trim().toLowerCase() : ''
      if (text === 'disable maintenance mode' && isAdminPhone(from)) {
        await supabaseCheck
          .from('maintenance_mode')
          .update({ enabled: false, disabled_by: (await supabaseCheck.auth.getUser()).data.user?.id, disabled_at: new Date().toISOString() })
          .eq('enabled', true)
        await sendTextMessage(from, 'Maintenance mode disabled. Service is now available.', phoneNumberId)
        return new NextResponse(null, { status: 200 })
      }
      
      // Cache the message for later processing
      await supabaseCheck
        .from('cached_messages')
        .insert({
          phone_number: from,
          message_type: msg.type,
          content: msg as any
        })
      
      // Send maintenance message
      await sendTextMessage(from, maintenance.message || 'We are currently under maintenance. Please send your screenshot again in 2-3 hours.', phoneNumberId)
      return new NextResponse(null, { status: 200 })
    }
    
    // Check for admin enable maintenance command (for any message type)
    if (msg.type === 'text') {
      const text = msg.text?.body?.trim().toLowerCase() || ''
      if (text === 'enable maintenance mode' && isAdminPhone(from)) {
        await supabaseCheck
          .from('maintenance_mode')
          .update({ enabled: true, enabled_by: (await supabaseCheck.auth.getUser()).data.user?.id, enabled_at: new Date().toISOString() })
          .eq('enabled', false)
        await sendTextMessage(from, 'Maintenance mode enabled. All incoming messages will be cached.', phoneNumberId)
        return new NextResponse(null, { status: 200 })
      }
    }

    // Admin commands to open/close the backdoor window (admin only)
    if (msg.type === 'text') {
      const text = msg.text?.body?.trim().toLowerCase() || ''
      if (text === 'disable backdoor window' && isAdminPhone(from)) {
        await supabaseCheck
          .from('backdoor_window')
          .update({ enabled: false, disabled_by: (await supabaseCheck.auth.getUser()).data.user?.id, disabled_at: new Date().toISOString() })
          .eq('enabled', true)
        await sendTextMessage(from, 'Backdoor window disabled. Backdoor submissions are now blocked.', phoneNumberId)
        return new NextResponse(null, { status: 200 })
      }
      if (text === 'enable backdoor window' && isAdminPhone(from)) {
        await supabaseCheck
          .from('backdoor_window')
          .update({ enabled: true, enabled_by: (await supabaseCheck.auth.getUser()).data.user?.id, enabled_at: new Date().toISOString() })
          .eq('enabled', false)
        await sendTextMessage(from, 'Backdoor window enabled. Backdoor submissions are open again.', phoneNumberId)
        return new NextResponse(null, { status: 200 })
      }
    }

    const imageMessages = messages.filter((m: any) => m.type === 'image')

    // If the sender is mid-backdoor-flow, treat any image as a backdoor
    // screenshot. Never run OCR on it: a duplicate/stray image must not trigger
    // the results-submit path or wipe the backdoor session.
    if (imageMessages.length > 0) {
      const session = await getSession(from)
      if (session?.state === 'awaiting_backdoor') {
        const imgMsg = imageMessages[0]
        const caption = imgMsg.image.caption?.trim() || ''
        const mediaId = imgMsg.image.id
        // Ignore re-deliveries of a screenshot we already saved for this flow
        // (WhatsApp/Vercel can deliver the same image with different message ids).
        if (session.backdoor_screenshot_media_id && session.backdoor_screenshot_media_id === mediaId) {
          console.log(`[webhook] duplicate backdoor screenshot ignored: ${mediaId}`)
          return
        }
        if (session.backdoor_menu_step === 'screenshot') {
          if (caption) {
            // User sent screenshot with team names in caption - search directly
            await upsertSession({
              phone_number: from,
              state: 'awaiting_backdoor',
              backdoor_menu_step: 'fixture_search',
              backdoor_screenshot_media_id: mediaId
            })
            await handleBackdoorFixtureSearch(from, caption, session, phoneNumberId)
            return
          }
          await upsertSession({
            phone_number: from,
            state: 'awaiting_backdoor',
            backdoor_menu_step: 'fixture_search',
            backdoor_screenshot_media_id: mediaId
          })
          await sendTextMessage(from, 'Which fixture? Type team names (e.g., "Arsenal vs Chelsea").', phoneNumberId)
          return
        }
        // Already past the screenshot step - ignore stray/duplicate images
        const backdoorPrompts: Record<string, string> = {
          menu: 'Reply 1 or 2. Type CANCEL to exit.',
          fixture_search: 'Screenshot received. Which fixture? Type team names (e.g., "Arsenal vs Chelsea").',
          fixture_select: 'Screenshot received. Reply with the number of your match.',
          side: 'Screenshot received. Reply "home" or "away". Type CANCEL to abort.',
          check: 'Reply 1 or 2. Type CANCEL to exit.',
        }
        const prompt = backdoorPrompts[session.backdoor_menu_step || ''] || 'Type team names or type CANCEL to exit.'
        await sendTextMessage(from, prompt, phoneNumberId)
        return
      }
    }

    // Handle multiple images: find the first one with a valid score
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
      // No useful caption, proceed to OCR
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
  team_id: string | null
  // Phone-number update fields (result submission mismatch flow)
  phone_update_profile_id: string | null
  phone_update_candidates: { profileId: string; teamName: string }[] | null
  // Backdoor fields
  backdoor_fixture_ids: string[] | null
  backdoor_submission_id: string | null
  backdoor_side: 'home' | 'away' | null
  backdoor_menu_step: 'menu' | 'screenshot' | 'fixture_search' | 'fixture_select' | 'side' | 'check' | null
  backdoor_screenshot_media_id: string | null
  // Submission type fields
  submission_type: 'new' | 'fix' | null
  submission_menu_step: 'menu' | null
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

async function isBackdoorWindowEnabled(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('backdoor_window')
      .select('enabled')
      .maybeSingle()
    return data?.enabled ?? true
  } catch {
    return true
  }
}

const BACKDOOR_DISABLED_MESSAGE =
  'Backdoor submissions are currently disabled because it is too early to be submitting backdoor. Submit again on Thursday when it opens'

async function handleBackdoorSearch(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const searchInput = text.trim()
  const stripped = searchInput.replace(/\d+\s*[-:]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim()

  const { start, end } = getWeekRange()

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name)')
    .eq('status', 'scheduled')
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('scheduled_date', { ascending: true })
    .order('matchday', { ascending: true })

  const allFixtures = (fixtures as any[]) || []

  const vsParts = stripped.split(/\s+vs\.?\s+/i)
  let teamSearches: string[]
  if (vsParts.length >= 2) {
    teamSearches = [vsParts[0].trim().toLowerCase(), vsParts.slice(1).join(' ').trim().toLowerCase()]
  } else {
    teamSearches = [stripped.toLowerCase().trim()]
  }
  teamSearches = teamSearches.filter((s: string) => s.length >= 2)

  if (teamSearches.length === 0) {
    await sendTextMessage(from, 'Please type at least one team name. Type CANCEL to start over.', phoneNumberId)
    return
  }

  const resolvedTeams = await Promise.all(teamSearches.map((s: string) => resolveTeamName(s)))

  if (resolvedTeams.some((r: string | null) => r === null)) {
    await sendTextMessage(from, `Could not find teams matching your input. Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
    return
  }

  const [r1, r2] = resolvedTeams as [string, string]
  const matchedFixtures = allFixtures.filter((f: any) => {
    const hName = fixtureTeamName(f, 'home').toLowerCase()
    const aName = fixtureTeamName(f, 'away').toLowerCase()
    return (hName === r1.toLowerCase() && aName === r2.toLowerCase()) || (hName === r2.toLowerCase() && aName === r1.toLowerCase())
  })

  if (matchedFixtures.length === 0) {
    await sendTextMessage(from, `No unconfirmed fixtures found matching "${searchInput}" in the last 7 days or next 7 days. Try different team names or type CANCEL.`, phoneNumberId)
    await clearSession(from)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_fixture',
    displayed_fixtures: matchedFixtures.map((f: any) => f.id),
  })

  const lines = matchedFixtures.map((f: any, i: number) => {
    const parts = [`${i + 1}. ${fixtureTeamName(f, 'home')} vs ${fixtureTeamName(f, 'away')}`]
    if (f.scheduled_date) parts.push(f.scheduled_date)
    if (fixtureTournamentName(f)) parts.push(fixtureTournamentName(f))
    return parts.join(' - ')
  })
  await sendTextMessage(from, `Found ${matchedFixtures.length} match${matchedFixtures.length === 1 ? '' : 'es'}:\n\n${lines.join('\n')}\n\nReply with the number. Type CANCEL to abort.`, phoneNumberId)
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

  const { data: fx } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('id', session.matched_fixture_id)
    .single()
  const h = fixtureTeamName(fx, 'home')
  const a = fixtureTeamName(fx, 'away')
  const winner = homeScore === 3 ? h : a
  const title = 'Backdoor win submitted'
  const body = `${winner} won ${homeScore}-${awayScore} vs ${winner === h ? a : h}`
  if (adminUserId) {
    await supabase.from('notifications').insert({
      user_id: adminUserId,
      type: 'match_result',
      title,
      body,
      data: { fixture_id: session.matched_fixture_id },
    })
    await sendPushToUsers(supabase, [adminUserId], {
      title,
      body,
      url: '/admin/results',
      tag: 'backdoor-win',
    }).catch(() => {})
  }

  await clearSession(from)
  await sendTextMessage(from, "Backdoor win submitted.", phoneNumberId)
}

// ─── Submission Type Selection (after OCR) ────────────────────────────────────

async function handleSubmissionType(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const step = session.submission_menu_step
  const lower = text.trim().toLowerCase()

  console.log('[handleSubmissionType] session:', JSON.stringify(session))

  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  if (step === 'menu') {
    if (lower === '1') {
      // Submitting scheduled fixture - filter by scheduled status
      await upsertSession({ 
        phone_number: from, 
        state: 'awaiting_match_name', 
        submission_type: 'new',
        home_team: session.home_team,
        away_team: session.away_team,
        home_score: session.home_score,
        away_score: session.away_score,
        match_stats: session.match_stats,
        screenshot_media_id: session.screenshot_media_id,
      })
      const { start, end } = getWeekRange()
      await sendTextMessage(from, `First-time submission (last 7 days to next 7 days).\n\nWhat match is this for? Type the team names, e.g. "Arsenal vs Everton". Type CANCEL to start over.`, phoneNumberId)
      return
    }
    if (lower === '2') {
      // Fixing already submitted fixture - filter by confirmed/awaiting_confirmation
      await upsertSession({ 
        phone_number: from, 
        state: 'awaiting_match_name', 
        submission_type: 'fix',
        home_team: session.home_team,
        away_team: session.away_team,
        home_score: session.home_score,
        away_score: session.away_score,
        match_stats: session.match_stats,
        screenshot_media_id: session.screenshot_media_id,
      })
      const { start, end } = getWeekRange()
      await sendTextMessage(from, `Changing an already-submitted score (last 7 days to next 7 days).\n\nWhat match is this for? Type the team names, e.g. "Arsenal vs Everton". Type CANCEL to start over.`, phoneNumberId)
      return
    }
    await sendTextMessage(from, 'Reply 1 or 2.', phoneNumberId)
    return
  }
}

// ─── Phone number update (result submission mismatch flow) ────────────────────
//
// After a result is submitted, compare the WhatsApp number the manager is
// texting from against the phone number stored on their profile. If they no
// longer match (or the profile has no number), offer to update it.

function normalizePhone(n: string | null | undefined): string | null {
  if (!n) return null
  const digits = String(n).replace(/\D/g, '')
  return digits || null
}

const PHONE_UPDATE_PROMPT =
  '\n\nYour number on the app does not match the number you are texting from. Update? Yes or No.'

async function getPhoneUpdatePrompt(from: string, session: SessionData, supabase: any): Promise<string | null> {
  if (!session.matched_fixture_id) return null

  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone)), away_team:teams!fixtures_away_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone))')
    .eq('id', session.matched_fixture_id)
    .single()

  if (!fixture) return null

  const managers = [fixture.home_team, fixture.away_team]
    .map((t: any) => {
      const team = Array.isArray(t) ? t[0] : t
      const manager = Array.isArray(team?.manager) ? team.manager[0] : team?.manager
      return {
        profileId: manager?.id || null,
        teamName: team?.name || '?',
        phone: manager?.phone || null,
      }
    })
    .filter((m: any) => m.profileId)

  if (managers.length === 0) return null

  const normFrom = normalizePhone(from)

  // If the texting number matches a manager's stored number, that manager is the
  // submitter — numbers agree, nothing to update.
  if (managers.some(m => normalizePhone(m.phone) === normFrom)) return null

  // Otherwise the submitter is a manager whose stored number is missing/different.
  const candidates = managers.filter(m => normalizePhone(m.phone) !== normFrom)

  if (candidates.length === 1) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_phone_update',
      phone_update_profile_id: candidates[0].profileId,
    })
    return PHONE_UPDATE_PROMPT
  }

  // Both managers look like candidates — ask which team they manage first.
  await upsertSession({
    phone_number: from,
    state: 'awaiting_phone_team_confirm',
    phone_update_candidates: candidates.map(c => ({ profileId: c.profileId, teamName: c.teamName })),
  })
  return PHONE_UPDATE_PROMPT
}

async function handlePhoneUpdate(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const lower = text.trim().toLowerCase()
  const supabase = await createAdminClient()

  if (/^(yes|yeah|yep|y|ja|ok|okay|sure|update|confirm)$/i.test(lower)) {
    if (!session.phone_update_profile_id) {
      await clearSession(from)
      await sendTextMessage(from, 'Something went wrong. Try again later.', phoneNumberId)
      return
    }
    await supabase.from('profiles').update({ phone: from }).eq('id', session.phone_update_profile_id)
    await clearSession(from)
    await sendTextMessage(from, `Updated! Your number on the app is now ${from}.`, phoneNumberId)
    return
  }

  if (/^(no|nah|nope|n|cancel)$/i.test(lower)) {
    await clearSession(from)
    await sendTextMessage(from, 'No problem. Your number stays as it is.', phoneNumberId)
    return
  }

  await sendTextMessage(from, `Update your number to ${from}? Reply YES or NO.`, phoneNumberId)
}

async function handlePhoneTeamConfirm(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const lower = text.trim().toLowerCase()
  const supabase = await createAdminClient()

  if (/^cancel$/i.test(lower)) {
    await clearSession(from)
    await sendTextMessage(from, 'No problem. Your number stays as it is.', phoneNumberId)
    return
  }

  const candidates: { profileId: string; teamName: string }[] = session.phone_update_candidates || []
  if (candidates.length === 0) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong. Try again later.', phoneNumberId)
    return
  }

  const match = candidates.find(c =>
    c.teamName.toLowerCase() === lower ||
    lower.includes(c.teamName.toLowerCase()) ||
    c.teamName.toLowerCase().includes(lower),
  )

  if (!match) {
    await sendTextMessage(from, `Which team do you manage? Reply ${candidates.map(c => c.teamName).join(' or ')}. Type CANCEL to skip.`, phoneNumberId)
    return
  }

  await supabase.from('profiles').update({ phone: from }).eq('id', match.profileId)
  await clearSession(from)
  await sendTextMessage(from, `Updated! Your number on the app is now ${from}.`, phoneNumberId)
}

// ─── Check fixtures flow ───────────────────────────────────────────────────────

function formatDateLabel(dateKey: string): string {
  try {
    const d = new Date(`${dateKey}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) return dateKey
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  } catch {
    return dateKey
  }
}

async function sendFixturesForTeam(from: string, teamId: string, teamName: string, dateKey: string | null, phoneNumberId: string) {
  const supabase = await createAdminClient()
  const useDate = dateKey || new Date().toISOString().slice(0, 10)

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status, scheduled_date, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
    .or(`and(home_team_id.eq.${teamId},scheduled_date.eq.${useDate}),and(away_team_id.eq.${teamId},scheduled_date.eq.${useDate})`)
    .in('status', ['scheduled', 'confirmed'])
    .order('matchday', { ascending: true })
    .order('scheduled_date', { ascending: true })

  const allFixtures = (fixtures as any[]) || []

  if (allFixtures.length === 0) {
    await upsertSession({ phone_number: from, pending_date: useDate })
    await sendTextMessage(from, `No fixtures found for ${teamName} on ${formatDateLabel(useDate)}.\n\nType a date (e.g. 15 Aug) to check another day, or type CANCEL to exit.`, phoneNumberId)
    return
  }

  await upsertSession({
    phone_number: from,
    pending_date: useDate,
    displayed_fixtures: allFixtures.map(f => f.id),
  })

  const scheduled = allFixtures.filter(f => f.status === 'scheduled')
  const confirmed = allFixtures.filter(f => f.status === 'confirmed')

  const lines: string[] = []
  let idx = 0
  if (scheduled.length > 0) {
    lines.push('Scheduled:')
    for (const f of scheduled) lines.push(formatFixtureLine(f, idx++))
    lines.push('')
  }
  if (confirmed.length > 0) {
    lines.push('Confirmed:')
    for (const f of confirmed) lines.push(formatFixtureLine(f, idx++))
    lines.push('')
  }

  await sendTextMessage(from, `Fixtures for ${teamName} on ${formatDateLabel(useDate)}:\n\n${lines.join('\n')}\n\nReply with a number to get your opponent's contact, or type a date (e.g. 15 Aug) to check fixtures for another day. Type CANCEL to exit.`, phoneNumberId)
}

async function handleFixturesTeam(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const teamName = await resolveTeamName(text.trim())
  if (!teamName) {
    await sendTextMessage(from, `Could not find a team matching "${text.trim()}". Please write the full team name. Type CANCEL to exit.`, phoneNumberId)
    return
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, manager:profiles!teams_manager_id_fkey(id, phone)')
    .eq('name', teamName)
    .maybeSingle()
  if (!team) {
    await sendTextMessage(from, `Could not find a team matching "${text.trim()}". Please write the full team name. Type CANCEL to exit.`, phoneNumberId)
    return
  }

  const manager = Array.isArray(team.manager) ? team.manager[0] : team.manager
  const storedPhone = normalizePhone(manager?.phone || null)
  const normFrom = normalizePhone(from)
  const phoneMatches = storedPhone !== null && storedPhone === normFrom

  // Number matches (or there is no manager profile to compare) → fixtures directly.
  if (!manager?.id || phoneMatches) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixtures_action',
      home_team: team.name,
      team_id: team.id,
    })
    await sendFixturesForTeam(from, team.id, team.name, null, phoneNumberId)
    return
  }

  // Number is missing or different from what's on the system → offer to update
  // before showing the fixtures (yes updates, later skips; fixtures show either way).
  await upsertSession({
    phone_number: from,
    state: 'awaiting_fixtures_phone_confirm',
    home_team: team.name,
    team_id: team.id,
    phone_update_profile_id: manager.id,
  })
  await sendTextMessage(from, `The number you are texting from does not match the number on the system for ${team.name}. Update? Yes or Later.`, phoneNumberId)
}

async function handleFixturesPhoneConfirm(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const lower = text.trim().toLowerCase()
  const supabase = await createAdminClient()

  const affirm = /^(yes|yeah|yep|y|ja|ok|okay|sure|update|confirm)$/i.test(lower)
  const decline = /^(later|no|nah|nope|n|skip)$/i.test(lower)

  if (affirm) {
    if (session.phone_update_profile_id) {
      await supabase.from('profiles').update({ phone: from }).eq('id', session.phone_update_profile_id)
      await sendTextMessage(from, 'Updated!', phoneNumberId)
    } else {
      await sendTextMessage(from, 'Could not update — no profile saved for this team.', phoneNumberId)
    }
  } else if (decline) {
    await sendTextMessage(from, 'No problem. Here are your fixtures.', phoneNumberId)
  } else {
    await sendTextMessage(from, 'Update the number you are texting from? Reply YES or LATER.', phoneNumberId)
    return
  }

  if (!session.team_id) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_fixtures_action',
    home_team: session.home_team,
    team_id: session.team_id,
    phone_update_profile_id: null,
  })
  await sendFixturesForTeam(from, session.team_id, session.home_team || 'your team', null, phoneNumberId)
}

async function sendOpponentContact(from: string, fixtureId: string, myTeamId: string, phoneNumberId: string) {
  const supabase = await createAdminClient()
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone, whatsapp_number)), away_team:teams!fixtures_away_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone, whatsapp_number))')
    .eq('id', fixtureId)
    .single()

  if (!fixture) {
    await sendTextMessage(from, 'Could not load that fixture. Try again.', phoneNumberId)
    return
  }

  const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
  const opponent = String(fixture.home_team_id) === String(myTeamId) ? awayTeam : homeTeam

  if (!opponent) {
    await sendTextMessage(from, 'Could not find the opponent for that fixture.', phoneNumberId)
    return
  }

  const manager = Array.isArray(opponent.manager) ? opponent.manager[0] : opponent.manager
  const phoneRaw = manager?.phone || manager?.whatsapp_number || null
  const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, '') : null

  if (!phone) {
    await sendTextMessage(from, `No contact number is saved for ${opponent.name} yet.`, phoneNumberId)
    return
  }

  await sendContactMessage(from, { formattedName: opponent.name, phone }, phoneNumberId)
}

async function handleFixturesAction(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const trimmed = text.trim()
  const isPureNumber = /^\d+$/.test(trimmed)

  if (isPureNumber) {
    const num = parseInt(trimmed, 10)
    if (session.displayed_fixtures && num >= 1 && num <= session.displayed_fixtures.length) {
      if (!session.team_id) {
        await clearSession(from)
        await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
        return
      }
      await sendOpponentContact(from, session.displayed_fixtures[num - 1], session.team_id, phoneNumberId)
      return
    }
  }

  const parsed = parseUserDate(trimmed)
  if (parsed) {
    if (!session.team_id) {
      await clearSession(from)
      await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
      return
    }
    await sendFixturesForTeam(from, session.team_id, session.home_team || 'your team', parsed.dateKey, phoneNumberId)
    return
  }

  await sendTextMessage(from, `Reply with a number from the list to get your opponent's contact, or type a date (e.g. 15 Aug) to check fixtures for another day. Type CANCEL to exit.`, phoneNumberId)
}

// ─── Backdoor User Flow ──────────────────────────────────────────────────────────

async function handleBackdoorFlow(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const step = session.backdoor_menu_step
  const lower = text.trim().toLowerCase()

  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  if (step === 'menu') {
    if (lower === '1') {
      const supabase = await createAdminClient()
      if (!(await isBackdoorWindowEnabled(supabase))) {
        await sendTextMessage(from, BACKDOOR_DISABLED_MESSAGE, phoneNumberId)
        return
      }
      await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'screenshot' })
      await sendTextMessage(from, 'Send a screenshot showing the opponent not responding.', phoneNumberId)
      return
    }
    if (lower === '2') {
      await showUserBackdoorApplications(from, phoneNumberId)
      await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
      return
    }
    await sendTextMessage(from, 'Reply 1 or 2.', phoneNumberId)
    return
  }

  if (step === 'screenshot') {
    await sendTextMessage(from, 'Please send a screenshot first.', phoneNumberId)
    return
  }

  if (step === 'fixture_search') {
    await handleBackdoorFixtureSearch(from, text, session, phoneNumberId)
    return
  }

  if (step === 'fixture_select') {
    await handleBackdoorFixtureSelect(from, text, session, phoneNumberId)
    return
  }

  if (step === 'side') {
    await handleBackdoorSideSelect(from, text, session, phoneNumberId)
    return
  }

  if (step === 'check') {
    await showUserBackdoorApplications(from, phoneNumberId)
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
    return
  }
}

async function handleBackdoorFixtureSearch(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const supabase = await createAdminClient()
  const searchInput = text.trim()

  // Strip score patterns
  const stripped = searchInput.replace(/\d+\s*[-:]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim()

  const { start, end } = getWeekRange()

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name)')
    .eq('status', 'scheduled')
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('scheduled_date', { ascending: false })
    .order('matchday')

  const allFixtures = (fixtures as any[]) || []

  const vsParts = stripped.split(/\s+vs\.?\s+/i)
  let teamSearches: string[]
  if (vsParts.length >= 2) {
    teamSearches = [vsParts[0].trim().toLowerCase(), vsParts.slice(1).join(' ').trim().toLowerCase()]
  } else {
    const words = stripped.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 1)
    teamSearches = [stripped.toLowerCase().trim()]
  }
  teamSearches = teamSearches.filter((s: string) => s.length >= 2)

if (teamSearches.length === 0) {
    await sendTextMessage(from, 'Please type at least one team name. Type CANCEL to start over.', phoneNumberId)
    return
  }

  // Resolve team names using database aliases
  const resolvedTeams = await Promise.all(
    teamSearches.map(s => resolveTeamName(s))
  )
  
  if (resolvedTeams.some(r => r === null)) {
    await sendTextMessage(from, `Could not find teams matching your input. Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
    return
  }

  const [resolved1, resolved2] = resolvedTeams as [string, string]
  
  // Strict exact matching - both teams must match exactly (case-insensitive, permutation-aware)
  const matched = allFixtures.filter(f => {
    const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
    const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
    
    const r1 = resolved1.toLowerCase()
    const r2 = resolved2.toLowerCase()
    const h = hName.toLowerCase()
    const a = aName.toLowerCase()
    
    return (h === r1 && a === r2) || (h === r2 && a === r1)
  })
  const matchedFixtures = sortFixturesForDisplay(matched)

  if (matchedFixtures.length === 0) {
    await sendTextMessage(from, `No fixtures found matching "${searchInput}". Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
    return
  }

  if (matchedFixtures.length === 0) {
    await sendTextMessage(from, `No fixtures found matching "${searchInput}". Try different team names or type CANCEL.`, phoneNumberId)
    return
  }

  if (matchedFixtures.length === 1) {
    const f = matchedFixtures[0]
    const hName = fixtureTeamName(f, 'home')
    const aName = fixtureTeamName(f, 'away')

    await upsertSession({
      phone_number: from,
      state: 'awaiting_backdoor',
      backdoor_menu_step: 'side',
      matched_fixture_id: f.id,
      backdoor_side: null,
    })

    await sendTextMessage(from, `${hName} vs ${aName}\n\nWho is not responding? Reply "home" or "away". Type CANCEL to abort.`, phoneNumberId)
    return
  }

  // Multiple matches
  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor',
    backdoor_menu_step: 'fixture_select',
    backdoor_fixture_ids: matchedFixtures.map((f: any) => f.id),
  })

  await sendTextMessage(from, `Found ${matchedFixtures.length} matches:\n\n${formatFixtureListWithHeadings(matchedFixtures)}\n\nReply with the number of your match. Type CANCEL to start over.`, phoneNumberId)
}

// Sort fixtures the same way formatFixtureListWithHeadings displays them so the
// numbered list a manager sees is always in the same order as the stored id
// arrays (displayed_fixtures / backdoor_fixture_ids) that selection indexes into.
function sortFixturesForDisplay(fixtures: any[]): any[] {
  return [...fixtures].sort((a, b) => {
    const da = a?.scheduled_date || '9999-12-31'
    const db = b?.scheduled_date || '9999-12-31'
    return String(da).localeCompare(String(db))
  })
}

function formatFixtureListWithHeadings(fixtures: any[]): string {
  if (fixtures.length === 0) return 'No matches found.'

  const lines: string[] = []
  const MAX_CHARS = 3800 // Leave buffer for WhatsApp 4096 limit

  // Sort by date ascending, fixtures without a date last
  const sorted = [...fixtures].sort((a, b) => {
    const da = a.scheduled_date || '9999-12-31'
    const db = b.scheduled_date || '9999-12-31'
    return da.localeCompare(db)
  })

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i]
    const home = fixtureTeamName(f, 'home')
    const away = fixtureTeamName(f, 'away')
    const date = formatFixtureWhen(f)
    const tournament = fixtureTournamentName(f)

    let status: string
    if (f.status === 'confirmed') {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      status = result ? `Submitted, ${result.home_score}-${result.away_score}` : 'Submitted'
    } else if (f.status === 'awaiting_confirmation') {
      status = 'Awaiting confirmation'
    } else {
      status = 'Pending'
    }

    const line = `${i + 1}. ${home} vs ${away}${date ? ` - ${date}` : ''}${tournament ? ` - ${tournament}` : ''} (${status})`

    if (lines.join('\n').length + line.length > MAX_CHARS) {
      const remaining = sorted.length - i
      lines.push(`... and ${remaining} more matches. Type team names to narrow search.`)
      break
    }
    lines.push(line)
  }

  return lines.join('\n')
}

async function handleBackdoorFixtureSelect(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  const num = parseInt(text.trim(), 10)
  if (isNaN(num) || num < 1 || num > (session.backdoor_fixture_ids?.length || 0)) {
    await sendTextMessage(from, `Pick a number between 1 and ${session.backdoor_fixture_ids?.length || 0}.`, phoneNumberId)
    return
  }
  const fixtureId = session.backdoor_fixture_ids![num - 1]
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('id', fixtureId)
    .single()
  const h = fixtureTeamName(data, 'home')
  const a = fixtureTeamName(data, 'away')

  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor',
    backdoor_menu_step: 'side',
    matched_fixture_id: fixtureId,
  })

  await sendTextMessage(from, `${h} vs ${a}\n\nWho is not responding? Reply "home" or "away". Type CANCEL to abort.`, phoneNumberId)
}

async function handleBackdoorSideSelect(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const lower = text.trim().toLowerCase()
  if (!/^(home|away)$/i.test(lower)) {
    await sendTextMessage(from, 'Reply "home" or "away".', phoneNumberId)
    return
  }
  const side = lower as 'home' | 'away'
  const supabase = await createAdminClient()

  // Final gate: if the backdoor window has been closed since the flow started, block.
  if (!(await isBackdoorWindowEnabled(supabase))) {
    await sendTextMessage(from, BACKDOOR_DISABLED_MESSAGE, phoneNumberId)
    await clearSession(from)
    return
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('backdoor_submissions')
    .select('id, status')
    .eq('submitter_phone', from)
    .eq('fixture_id', session.matched_fixture_id)
    .in('status', ['pending', 'approved', 'declined'])
    .maybeSingle()

  if (existing) {
    await sendTextMessage(from, 'You have already submitted a backdoor for this match.', phoneNumberId)
    await clearSession(from)
    return
  }

  // Check fixture still scheduled
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('status')
    .eq('id', session.matched_fixture_id)
    .single()

  if (!fixture || fixture.status !== 'scheduled') {
    await sendTextMessage(from, 'This fixture is no longer available for backdoor.', phoneNumberId)
    await clearSession(from)
    return
  }

  // Calculate expires_at (next Tuesday 23:59:59)
  const expiresAt = new Date()
  const daysUntilTuesday = (2 - expiresAt.getDay() + 7) % 7 || 7
  expiresAt.setDate(expiresAt.getDate() + daysUntilTuesday)
  expiresAt.setHours(23, 59, 59, 999)

  // Upload screenshot to Supabase Storage
  let screenshotUrl: string
  try {
    screenshotUrl = await uploadScreenshotToStorage(session.backdoor_screenshot_media_id!)
  } catch (e) {
    console.error('[backdoor] screenshot upload failed:', e)
    await sendTextMessage(from, 'Error occurred, please send image again.', phoneNumberId)
    return
  }

  // Insert submission
  const { data: submission, error } = await supabase
    .from('backdoor_submissions')
    .insert({
      fixture_id: session.matched_fixture_id,
      submitter_phone: from,
      side_claimed: side,
      screenshot_media_id: session.backdoor_screenshot_media_id,
      screenshot_url: screenshotUrl,
      expires_at: expiresAt.toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('[backdoor] insert failed:', error)
    await sendTextMessage(from, 'Failed to submit. Try again.', phoneNumberId)
    return
  }

  // Notify all admins (in-app + browser push)
  try {
    const { data: fx } = await supabase
      .from('fixtures')
      .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', session.matched_fixture_id)
      .single()
    await notifyBackdoorSubmitted(supabase, {
      submissionId: submission.id,
      fixtureId: session.matched_fixture_id!,
      nonRespondingSide: side,
      homeName: fixtureTeamName(fx, 'home'),
      awayName: fixtureTeamName(fx, 'away'),
    })
  } catch (e) {
    console.error('[backdoor] admin notify failed:', e)
  }

  await clearSession(from)
  await sendTextMessage(from, 'Thanks. Admin will review and get back to you.', phoneNumberId)
}

async function showUserBackdoorApplications(from: string, phoneNumberId: string) {
  const supabase = await createAdminClient()

  // Expire approved/declined/void submissions older than 7 days so they stop piling up
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('backdoor_submissions')
    .update({ status: 'expired' })
    .eq('submitter_phone', from)
    .in('status', ['approved', 'declined', 'void_game_played'])
    .or(`reviewed_at.lt.${weekAgo},and(reviewed_at.is.null,created_at.lt.${weekAgo})`)

  const { data: submissions } = await supabase
    .from('backdoor_submissions')
    .select('id, fixture_id, side_claimed, status, created_at, fixtures!inner(home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), scheduled_date, tournament:tournaments(name))')
    .eq('submitter_phone', from)
    .neq('status', 'expired')
    .order('created_at', { ascending: false })

  if (!submissions?.length) {
    await sendTextMessage(from, 'No backdoor applications found.', phoneNumberId)
    return
  }

  const lines = submissions.map((s, i) => {
    const f = s.fixtures as any
    const homeName = Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name || 'Unknown'
    const awayName = Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name || 'Unknown'
    const teams = `${homeName} vs ${awayName}`
    const status = s.status as 'pending' | 'approved' | 'declined' | 'void_game_played' | 'expired'
    const statusLabel = {
      pending: '⏳ Pending',
      approved: '✅ Approved - 3-0 awarded',
      declined: '❌ Declined',
      void_game_played: '🕳️ Void - game already played',
      expired: '⏰ Expired'
    }[status] || s.status
    const parts = [`${i + 1}. ${teams}`]
    if (f.scheduled_date) parts.push(f.scheduled_date)
    if (fixtureTournamentName(f)) parts.push(fixtureTournamentName(f))
    parts.push(`(${statusLabel})`)
    return parts.join(' - ')
  })

  await sendTextMessage(from, `Your Backdoor Applications:\n\n${lines.join('\n')}`, phoneNumberId)
}

// ─── Screenshot Upload Helper ────────────────────────────────────────────────────

async function uploadScreenshotToStorage(mediaId: string): Promise<string> {
  const supabase = await createAdminClient()
  const mediaUrl = await getMediaUrl(mediaId)
  const { buffer } = await fetchImageBytes(mediaUrl)
  const fileName = `backdoor-${Date.now()}-${mediaId}.jpg`
  const { data, error } = await supabase.storage
    .from('backdoor-screenshots')
    .upload(fileName, buffer, { contentType: 'image/jpeg' })
  if (error) throw error
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('backdoor-screenshots')
    .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year
  if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError || new Error('Failed to create signed URL')
  return signedUrlData.signedUrl
}

// ─── Admin Backdoor Review Flow ──────────────────────────────────────────────────

async function showBackdoorSubmissionsForReview(from: string, phoneNumberId: string) {
  const supabase = await createAdminClient()
  const { data: pending } = await supabase
    .from('backdoor_submissions')
    .select('id, fixture_id, submitter_phone, side_claimed, screenshot_url, created_at, fixtures!inner(home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), scheduled_date, tournament:tournaments(name))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (!pending?.length) {
    await sendTextMessage(from, 'No pending backdoor submissions.', phoneNumberId)
    return
  }

  // Group by fixture
  const byFixture = new Map<string, any[]>()
  for (const s of pending) {
    const key = s.fixture_id
    if (!byFixture.has(key)) byFixture.set(key, [])
    byFixture.get(key)!.push(s)
  }

  let idx = 1
  const lines: string[] = []
  const fixtureIds: string[] = []
  for (const [fixtureId, subs] of byFixture) {
    const f = subs[0].fixtures
    const homeName = fixtureTeamName(f, 'home')
    const awayName = fixtureTeamName(f, 'away')
    const teams = `${homeName} vs ${awayName}`
    const meta = [f.scheduled_date, fixtureTournamentName(f)].filter(Boolean).join(' - ')
    if (subs.length === 2) {
      lines.push(`${idx}. ${teams}${meta ? ` - ${meta}` : ''} - backdoor submitted by both teams`)
    } else {
      const side = subs[0].side_claimed === 'home' ? homeName : awayName
      lines.push(`${idx}. ${teams}${meta ? ` - ${meta}` : ''} - backdoor submitted by ${side}`)
    }
    fixtureIds.push(fixtureId)
    idx++
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_admin_review',
    displayed_fixtures: fixtureIds
  })

  await sendTextMessage(from,
    `Pending Backdoor Reviews:\n\n${lines.join('\n')}\n\nReply with number to review. Type CANCEL.`,
    phoneNumberId
  )
}

async function handleBackdoorAdminReview(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  const num = parseInt(text.trim(), 10)
  if (isNaN(num) || num < 1 || num > (session.displayed_fixtures?.length || 0)) {
    await sendTextMessage(from, `Pick a number between 1 and ${session.displayed_fixtures?.length || 0}.`, phoneNumberId)
    return
  }
  const fixtureId = session.displayed_fixtures![num - 1]
  const supabase = await createAdminClient()

  const { data: submissions } = await supabase
    .from('backdoor_submissions')
    .select('id, submitter_phone, side_claimed, screenshot_url')
    .eq('fixture_id', fixtureId)
    .eq('status', 'pending')

  if (!submissions?.length) {
    await sendTextMessage(from, 'No pending submissions for this fixture.', phoneNumberId)
    return
  }

  // Store submission IDs for decision step
  const submissionIds = submissions.map(s => s.id)
  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_admin_decision',
    backdoor_fixture_ids: submissionIds,
    matched_fixture_id: fixtureId
  })

  // Send screenshot URLs to admin
  for (const s of submissions) {
    const side = s.side_claimed === 'home' ? 'Home' : 'Away'
    await sendTextMessage(from, `Submission by ${s.submitter_phone} (${side} team):\nScreenshot: ${s.screenshot_url}`, phoneNumberId)
  }

  await sendTextMessage(from, 'Approve or decline? Reply "approve" or "decline".', phoneNumberId)
}

async function handleBackdoorAdminDecision(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const lower = text.trim().toLowerCase()
  if (!/^(approve|decline)$/i.test(lower)) {
    await sendTextMessage(from, 'Reply "approve" or "decline".', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const submissionIds = session.backdoor_fixture_ids || []
  const fixtureId = session.matched_fixture_id

  if (lower === 'approve') {
    // Determine outcome based on number of submissions
    const { data: submissions } = await supabase
      .from('backdoor_submissions')
      .select('id, side_claimed')
      .in('id', submissionIds)

    let homeScore = 0, awayScore = 0
    if (submissions?.length === 2) {
      // Both submitted -> 0-0 draw
      homeScore = 0; awayScore = 0
    } else if (submissions?.length === 1) {
      // One submitted -> 3-0 to that side
      if (submissions[0].side_claimed === 'home') {
        homeScore = 3; awayScore = 0
      } else {
        homeScore = 0; awayScore = 3
      }
    }

    // Call finalise-result logic
    const adminUserId = await getAdminUserId(supabase)

    await supabase.from('result_confirmations').insert({
      fixture_id: fixtureId,
      home_score: homeScore,
      away_score: awayScore,
      submitted_by: adminUserId,
    })

    await supabase.from('results').upsert({
      fixture_id: fixtureId,
      home_score: homeScore,
      away_score: awayScore,
      finalised_by: adminUserId,
    }, { onConflict: 'fixture_id' })

    await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fixtureId)

    // Update backdoor submissions to approved
    await supabase
      .from('backdoor_submissions')
      .update({ status: 'approved', reviewed_by: adminUserId, reviewed_at: new Date().toISOString() })
      .in('id', submissionIds)

    // Notify the reporting manager(s) (in-app + push) + admins (push)
    try {
      await notifyBackdoorDecision(supabase, submissionIds, 'approved')
    } catch (e) {
      console.error('[backdoor] approve notify failed:', e)
    }

    // Recalculate standings
    const { data: fixData } = await supabase.from('fixtures').select('tournament_id').eq('id', fixtureId).single()
    if (fixData?.tournament_id) {
      try { await recalculateStandings(fixData.tournament_id) } catch (e) {}
    }

    await sendTextMessage(from, `Approved. Result: ${homeScore}-${awayScore}. Fixture confirmed.`, phoneNumberId)
  } else {
    // Decline
    const adminUserId = await getAdminUserId(supabase)
    await supabase
      .from('backdoor_submissions')
      .update({ status: 'declined', reviewed_by: adminUserId, reviewed_at: new Date().toISOString() })
      .in('id', submissionIds)

    // Notify the reporting manager(s) (in-app + push)
    try {
      await notifyBackdoorDecision(supabase, submissionIds, 'declined')
    } catch (e) {
      console.error('[backdoor] decline notify failed:', e)
    }

    await sendTextMessage(from, 'Declined. Fixture remains scheduled.', phoneNumberId)
  }

  await clearSession(from)
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

const APP_TIME_ZONE = 'Africa/Johannesburg'

// Render a fixture's kickoff as a readable SAST label (e.g. "Tue 12 Aug · 02:00")
// so every WhatsApp list/confirm shows the same date the admin dashboard shows.
function formatFixtureWhen(f: any): string {
  const raw = f?.scheduled_date
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return String(raw)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: APP_TIME_ZONE,
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
    return `${datePart} · ${timePart}`
  } catch {
    return String(raw)
  }
}

function fixtureTournamentName(f: any): string {
  const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
  return (t?.name as string) || ''
}

function formatFixtureLine(f: any, index: number): string {
  const hN = fixtureTeamName(f, 'home')
  const aN = fixtureTeamName(f, 'away')
  const date = formatFixtureWhen(f)
  const tournament = fixtureTournamentName(f)
  const result = Array.isArray(f.results) ? f.results[0] : f.results
  let line: string
  if (result && (f.status === 'confirmed' || f.status === 'awaiting_confirmation')) {
    line = `${index + 1}. ${hN} ${result.home_score} - ${result.away_score} ${aN}`
  } else {
    line = `${index + 1}. ${hN} vs ${aN}`
  }
  return `${line}${date ? ` - ${date}` : ''}${tournament ? ` - ${tournament}` : ''}${result && (f.status === 'confirmed' || f.status === 'awaiting_confirmation') ? ' (SUBMITTED)' : ''}`
}

function isFixtureConfirmed(f: any): boolean {
  return f.status === 'confirmed' || f.status === 'awaiting_confirmation'
}

// ─── Team name resolution (LLM + database fallback) ──────────────────────────────
// Fetches all team names once, then uses LLM to match abbreviations like "psg" -> "Paris Saint Germain"

let knownTeamsCache: string[] | null = null

async function getKnownTeams(): Promise<string[]> {
  if (knownTeamsCache) return knownTeamsCache
  const supabase = await createAdminClient()
  const { data } = await supabase.from('teams').select('name')
  knownTeamsCache = (data as any[])?.map(t => t.name).filter(Boolean) || []
  return knownTeamsCache
}

async function resolveTeamName(input: string): Promise<string | null> {
  const knownTeams = await getKnownTeams()
  
  // 1. LLM-based resolution (handles abbreviations, nicknames, typos)
  const llmMatch = await resolveTeamNameWithLLM(input, knownTeams)
  if (llmMatch) {
    console.log('[resolveTeamName] LLM resolved:', input, '->', llmMatch)
    return llmMatch
  }
  
  // 2. Fallback: exact alias match (case-insensitive)
  const supabase = await createAdminClient()
  const cleanInput = input.trim().toLowerCase()
  const { data: aliasMatch } = await supabase
    .from('team_aliases')
    .select('teams!inner(name)')
    .ilike('alias', cleanInput)
    .maybeSingle()
  
  if (aliasMatch) return (aliasMatch as any).teams?.name
  
  // 3. Fallback: full-text search on teams table
  const { data: teams } = await supabase
    .from('teams')
    .select('name')
    .textSearch('search_vector', cleanInput, { type: 'websearch' })
    .limit(3)
  
  if (teams?.length === 1) return teams[0].name
  return null
}

// ─── Team name matching helpers (shared) ────────────────────────────────────────

// ─── Strict exact team name matching ──────────────────────────────────────────────
// Both teams must match exactly (case-insensitive, permutation-aware)

async function fixtureMatches(f: any, teamSearches: string[]): Promise<boolean> {
  const hName = (Array.isArray(f.home_team) ? f.home_team[0]?.name : f.home_team?.name)?.toLowerCase() || ''
  const aName = (Array.isArray(f.away_team) ? f.away_team[0]?.name : f.away_team?.name)?.toLowerCase() || ''
  
  if (teamSearches.length !== 2) return false
  
  const [s1, s2] = teamSearches
  
  // Resolve aliases
  const [resolved1, resolved2] = await Promise.all([
    resolveTeamName(s1),
    resolveTeamName(s2)
  ])
  
  if (!resolved1 || !resolved2) return false
  
  const r1 = resolved1.toLowerCase()
  const r2 = resolved2.toLowerCase()
  const h = hName.toLowerCase()
  const a = aName.toLowerCase()
  
  // Exact word match (case-insensitive, permutation-aware)
  const match1 = (h === r1 && a === r2)
  const match2 = (h === r2 && a === r1)
  
  return match1 || match2
}

async function handleText(from: string, msg: { text: { body: string } }, phoneNumberId: string) {
  const text = (msg.text.body || '').trim()
  console.log(`[webhook] text: "${text}"`)

  const session = await getSession(from)
  console.log('[handleText] session:', JSON.stringify(session))

  // ─── Backdoor admin flow ──────────────────────────────────────────────────
  if (session?.state === 'awaiting_backdoor_admin_review') {
    await handleBackdoorAdminReview(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_backdoor_admin_decision') {
    await handleBackdoorAdminDecision(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_backdoor') {
    await handleBackdoorFlow(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_backdoor_search') {
    await handleBackdoorSearch(from, text, phoneNumberId)
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
  // ─── Phone number update (after result submission) ────────────────────────
  if (session?.state === 'awaiting_phone_update') {
    await handlePhoneUpdate(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_phone_team_confirm') {
    await handlePhoneTeamConfirm(from, text, session, phoneNumberId)
    return
  }
  // ─── Check fixtures ───────────────────────────────────────────────────────
  if (session?.state === 'awaiting_fixtures_team') {
    await handleFixturesTeam(from, text, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_fixtures_phone_confirm') {
    await handleFixturesPhoneConfirm(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_fixtures_action') {
    await handleFixturesAction(from, text, session, phoneNumberId)
    return
  }
  if (/^(check\s*)?(my\s*)?fixtures?$/i.test(text.trim())) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixtures_team',
      home_team: null,
      team_id: null,
      pending_date: null,
      displayed_fixtures: null,
      phone_update_profile_id: null,
      phone_update_candidates: null,
    })
    await sendTextMessage(from, 'What is your team name? Type CANCEL to exit.', phoneNumberId)
    return
  }
  // User types "backdoor" -> show menu (also accept common variants)
  if (/^(backdoor|backdoor applications|backdoor apps|check backdoor|my backdoors)$/i.test(text.trim())) {
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
    await sendTextMessage(from,
      'Backdoor Applications\n\n' +
      '1. Submit new backdoor\n' +
      '2. Check my applications\n\n' +
      'Reply with 1 or 2. Type CANCEL to exit.',
      phoneNumberId
    )
    return
  }
  // Admin types "backdoor admin" -> direct backdoor (admin only)
  if (/^backdoor admin$/i.test(text.trim())) {
    if (!isAdminPhone(from)) {
      await sendTextMessage(from, 'Admin only.', phoneNumberId)
      return
    }
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor_search' })
    await sendTextMessage(from, 'Enter the fixture (team names, e.g. "Arsenal vs Chelsea").', phoneNumberId)
    return
  }
  // Admin types "backdoor submissions" -> review flow (admin only)
  if (/^backdoor submissions$/i.test(text.trim())) {
    if (!isAdminPhone(from)) {
      await sendTextMessage(from, 'Admin only.', phoneNumberId)
      return
    }
    await showBackdoorSubmissionsForReview(from, phoneNumberId)
    return
  }
  // ─── Submission type selection (after screenshot OCR) ────────────────────────
  if (session?.state === 'awaiting_submission_type') {
    await handleSubmissionType(from, text, session, phoneNumberId)
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

    // Strip any score patterns (e.g. "3-2", "3:2", "3 2") so users can type
    // "inter milan 3-2 liverpool" and we only match on team names
    const stripped = searchInput.replace(/\d+\s*[-:]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim()

    // Determine status filter based on submission type
    let statusFilter: string[]
    if (session.submission_type === 'fix') {
      statusFilter = ['confirmed', 'awaiting_confirmation']
    } else {
      statusFilter = ['scheduled']
    }

    const vsParts = stripped.split(/\s+vs\.?\s+/i)
    let teamSearches: string[]
    if (vsParts.length >= 2) {
      teamSearches = [vsParts[0].trim().toLowerCase(), vsParts.slice(1).join(' ').trim().toLowerCase()]
    } else {
      // No "vs" separator — ask user to use proper format
      await sendTextMessage(from, 'Please use format "Team A vs Team B" (e.g. "Arsenal vs Everton").', phoneNumberId)
      return
    }
    teamSearches = teamSearches.filter((s: string) => s.length >= 2)

    if (teamSearches.length === 0) {
      await sendTextMessage(from, `No fixtures found matching "${searchInput}". Try different team names or type CANCEL.`, phoneNumberId)
      return
    }

    // Resolve team names using database aliases
    const resolvedTeams = await Promise.all(
      teamSearches.map(s => resolveTeamName(s))
    )

    if (resolvedTeams.some(r => r === null)) {
      await sendTextMessage(from, `Could not find teams matching your input. Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
      return
    }

    const [resolved1, resolved2] = resolvedTeams as [string, string]

    // Resolve canonical team names to team IDs
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .in('name', resolvedTeams as string[])
    const idByName = new Map((teamRows as any[] || []).map(t => [t.name.toLowerCase(), t.id]))
    const id1 = idByName.get(resolved1.toLowerCase())
    const id2 = idByName.get(resolved2.toLowerCase())

    if (!id1 || !id2) {
      await sendTextMessage(from, `Could not find teams matching your input. Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
      return
    }

    // Search ALL fixtures for this exact team pair (no date window) so a result
    // can be submitted even if the fixture fell outside the current ±7 day range.
    // If the pair has fixtures in multiple tournaments/dates, the numbered list
    // below lets the submitter pick the correct one.
    const { data: fixtures } = await supabase
      .from('fixtures')
      .select('id, home_team_id, away_team_id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
      .in('status', statusFilter)
      .or(`and(home_team_id.eq.${id1},away_team_id.eq.${id2}),and(home_team_id.eq.${id2},away_team_id.eq.${id1})`)
      .order('scheduled_date', { ascending: false })
      .order('matchday')

    const matchedFixtures = sortFixturesForDisplay((fixtures as any[]) || [])

    // If the user chose "first-time submission" and no scheduled fixture matches,
    // the match may already be submitted/confirmed. Surface the existing result
    // instead of a confusing "no fixture found" and offer to edit it.
    if (matchedFixtures.length === 0 && session.submission_type === 'new') {
      const { data: alreadyFixtures } = await supabase
        .from('fixtures')
        .select('id, home_team_id, away_team_id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score, match_stats:match_stats(*))')
        .in('status', ['confirmed', 'awaiting_confirmation', 'completed', 'abandoned'])
        .or(`and(home_team_id.eq.${id1},away_team_id.eq.${id2}),and(home_team_id.eq.${id2},away_team_id.eq.${id1})`)
        .order('scheduled_date', { ascending: false })
        .order('matchday')

      const alreadySubmitted = sortFixturesForDisplay((alreadyFixtures as any[]) || [])
      if (alreadySubmitted.length > 0) {
        const f = alreadySubmitted[alreadySubmitted.length - 1]
        const hName = fixtureTeamName(f, 'home')
        const aName = fixtureTeamName(f, 'away')
        const result = Array.isArray(f.results) ? f.results[0] : f.results
        const statsRow = Array.isArray(result?.match_stats) ? result.match_stats[0] : (result?.match_stats ?? null)
        const statsBlock = formatStatsBlock(statsRow ? dbStatsToSessionFormat(statsRow) : null)
        const dateLine = formatFixtureWhen(f) ? ` - ${formatFixtureWhen(f)}` : ''
        await upsertSession({ phone_number: from, state: 'awaiting_already_submitted' })
        await sendTextMessage(from, `This match has already been submitted. Here are the results and stats:\n\n${hName} ${result?.home_score ?? '?'}-${result?.away_score ?? '?'} ${aName}${dateLine}${statsBlock ? '\n\n' + statsBlock : ''}\n\nWould you like to edit it? Reply YES or NO.`, phoneNumberId)
        return
      }
    }

    if (matchedFixtures.length === 0) {
      await sendTextMessage(from, `No fixtures found matching "${searchInput}". Please write the full team names.\nFor example: instead of 'psg vs arsenal' write 'Paris Saint Germain vs Arsenal'`, phoneNumberId)
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
        home_team: hName, away_team: aName,
        state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
        displayed_fixtures: null,
      })

      const resultLine = result && (f.status === 'confirmed' || f.status === 'awaiting_confirmation')
        ? ` (already submitted: ${result.home_score}-${result.away_score})`
        : ''
      const dateLine = formatFixtureWhen(f) ? ` - ${formatFixtureWhen(f)}` : ''
      const tournamentLine = fixtureTournamentName(f) ? ` - ${fixtureTournamentName(f)}` : ''
      const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
      const statsBlock = formatStatsBlock(session.match_stats)
      await sendTextMessage(from, `Found: ${hName} vs ${aName}${dateLine}${tournamentLine}${resultLine}\n\nConfirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\nReply YES to submit. Type SWAP if stats are on the wrong side. Type EDIT SCORE to override the score. Type CANCEL to start over.`, phoneNumberId)
      return
    }

    // Multiple matches — show numbered list
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixture_from_past',
      displayed_fixtures: matchedFixtures.map((f: any) => f.id),
    })

    await sendTextMessage(from, `Found ${matchedFixtures.length} matches:\n\n${formatFixtureListWithHeadings(matchedFixtures)}\n\nReply with the number of your match. Type CANCEL to start over.`, phoneNumberId)
    return
  }

  // ─── Already-submitted match (user chose "first time" but fixture is confirmed) ─
  if (session?.state === 'awaiting_already_submitted') {
    const lower = text.trim().toLowerCase()
    if (/^(yes|yeah|yep|y|ja|ok|okay|sure|correct|edit|fix)$/i.test(lower)) {
      await clearSession(from)
      await sendTextMessage(from, "Got it. Send a new screenshot and choose option 2 (Changing a score that was already submitted).", phoneNumberId)
    } else if (/^(no|nah|nope|n)$/i.test(lower)) {
      await clearSession(from)
      await sendTextMessage(from, "If you need to submit a new match, send a new screenshot and let me know.", phoneNumberId)
    } else if (/^cancel$/i.test(text.trim())) {
      await clearSession(from)
      await sendTextMessage(from, "No stress. Send a new screenshot when you're ready.", phoneNumberId)
    } else {
      await sendTextMessage(from, "Would you like to edit the submitted result? Reply YES or NO.", phoneNumberId)
    }
    return
  }

  // Only reject users who have no active session at all (never sent a screenshot)
  // Exclude backdoor flow states which don't use scores
  const isBackdoorState = session?.state?.startsWith('awaiting_backdoor') === true
  if (!session || (!isBackdoorState && session.home_score === null && session.away_score === null)) {
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
    // SWAP — flip scores and stats to match DB orientation (team names stay from DB)
    if (/^swap$/i.test(lower)) {
      console.log('[webhook] user SWAP scores+stats:', session.home_team, 'vs', session.away_team)
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
        home_score: newHomeScore, away_score: newAwayScore,
        match_stats: newStats,
      })
      const statsBlock = formatStatsBlock(newStats)
      await sendTextMessage(from, `Scores swapped!\n\nConfirm result: ${session.home_team} ${newHomeScore}-${newAwayScore} ${session.away_team}?${statsBlock ? '\n\n' + statsBlock : ''}\n\nType SWAP if still wrong. Type EDIT SCORE to override. Type CANCEL to start again.`, phoneNumberId)
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
      .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
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
          home_team: hName, away_team: aName,
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
            home_team: hName, away_team: aName,
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
            .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
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
              home_team: hName, away_team: aName,
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
        if (cleaned.valid === false) {
          // Don't set invalidReason yet — vision may still find a score
        } else {
          homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats
        }
      }
    } catch {
      try {
        const cleaned = await cleanOcrWithGroq(ocrResult.rawText)
        if (cleaned) {
          if (cleaned.valid === false) {
            // Don't set invalidReason yet — vision may still find a score
          } else {
            homeTeam = cleaned.homeTeam; awayTeam = cleaned.awayTeam; homeScore = cleaned.homeScore; awayScore = cleaned.awayScore; matchStats = cleaned.matchStats
          }
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
        // vision says invalid — only keep text-based reason if vision also confirms it
        if (homeScore !== null) invalidReason = null  // text found scores, trust that
        else if (!invalidReason) invalidReason = geminiResult.reason || null
      } else {
        // vision found valid data — override any text-based invalidReason
        invalidReason = null
        if (geminiResult.homeScore != null && geminiResult.awayScore != null) {
          homeScore = geminiResult.homeScore; awayScore = geminiResult.awayScore
        }
        homeTeam = geminiResult.homeTeam || homeTeam; awayTeam = geminiResult.awayTeam || awayTeam
        if (!matchStats && geminiResult.matchStats) matchStats = geminiResult.matchStats
      }
    }
  } catch {}

  // If vision failed but text/OCR found scores, that's still valid
  if (homeScore !== null && awayScore !== null) invalidReason = null

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
    state: 'awaiting_submission_type',
    submission_type: null,
    submission_menu_step: 'menu'
  })

  await sendTextMessage(from, `Score extracted: ${homeTeam || '?'} ${homeScore}-${awayScore} ${awayTeam || '?'}\n\nWhat are we doing?\n1. Submitting this match's score for the first time\n2. Changing a score that was already submitted\n\nReply 1 or 2. Type CANCEL to start over.`, phoneNumberId)
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

function dbStatsToSessionFormat(statsRow: Record<string, number | null> | null): Record<string, { home: number; away: number }> | null {
  if (!statsRow) return null
  const out: Record<string, { home: number; away: number }> = {}
  for (const [key, [homeCol, awayCol]] of Object.entries(STAT_KEY_TO_DB)) {
    const home = statsRow[homeCol]
    const away = statsRow[awayCol]
    if (home !== null && home !== undefined && away !== null && away !== undefined) {
      out[key] = { home, away }
    }
  }
  return Object.keys(out).length > 0 ? out : null
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

  // Forfeit balance aggregate: check if either team has active forfeit balances against the current opponent
  // Skip when this is a forfeit confirm — handleForfeitYes already applied the +3
  if (!isForfeitConfirm && fixture?.home_team_id && fixture?.away_team_id && homeScore !== awayScore) {
    const losingTeamId = homeScore < awayScore ? fixture.home_team_id : fixture.away_team_id
    const opponentTeamId = homeScore < awayScore ? fixture.away_team_id : fixture.home_team_id
    const { data: balances } = await supabase
      .from('forfeit_balances')
      .select('id, forfeiting_score, opponent_score, forfeiting_team:teams!forfeit_balances_forfeiting_team_id_fkey(name), opponent_team:teams!forfeit_balances_opponent_team_id_fkey(name)')
      .eq('forfeiting_team_id', losingTeamId)
      .eq('opponent_team_id', opponentTeamId)
      .gt('remaining', 0)

    if (balances && balances.length > 0) {
      for (const bal of balances) {
        if (homeScore < awayScore) {
          homeScore += bal.forfeiting_score
          awayScore += bal.opponent_score
        } else {
          awayScore += bal.forfeiting_score
          homeScore += bal.opponent_score
        }
        await supabase.from('forfeit_balances').update({ remaining: 0 }).eq('id', bal.id)
      }

      const teamName = (Array.isArray(balances[0]?.forfeiting_team) ? balances[0].forfeiting_team[0]?.name : balances[0]?.forfeiting_team?.name) || 'Team'
      const oppName = (Array.isArray(balances[0]?.opponent_team) ? balances[0].opponent_team[0]?.name : balances[0]?.opponent_team?.name) || 'Opponent'
      forfeitBalanceNote = `\n\nForfeit balance applied: ${teamName} had ${balances.length} active forfeit balance(s) from ${oppName}. Aggregate adjusted to ${homeScore}-${awayScore}.`
      console.log('[webhook] forfeit balance applied:', teamName, 'vs', oppName, 'aggregate:', homeScore, '-', awayScore)
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

  const submittedMessage = `Result submitted!${forfeitBalanceNote}\n\nCheck your standings here: https://efa-fxyk.vercel.app/standings`

  // If the number the manager is texting from no longer matches their stored
  // profile phone, append an offer to update it (session stays live for the
  // follow-up answer).
  const phoneUpdatePrompt = await getPhoneUpdatePrompt(from, session, supabase)
  if (phoneUpdatePrompt) {
    await sendTextMessage(from, submittedMessage + phoneUpdatePrompt, phoneNumberId)
  } else {
    await clearSession(from)
    await sendTextMessage(from, submittedMessage, phoneNumberId)
  }

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

  if ((fixtureRow.whatsapp_reset_count || 0) >= MAX_WHATSAPP_RESETS && !isAdminPhone(from)) {
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
