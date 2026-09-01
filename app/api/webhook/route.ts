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
import { insertNotificationsAndPush } from '@/lib/notify'
import { parseUserDate } from '@/lib/date-parser'
import { listOpenSeasons, getSeasonPickableTeams, userInSeason } from '@/lib/season-applications'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'

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

// ─── Result submission window: 7 days ago .. 7 days ahead (inclusive) ──────────
// Non-admin players may submit results for games due up to 7 days in the FUTURE
// (captured as 'confirmed_pending' until the fixture date) or within the last
// 7 days. Admins can submit any fixture regardless of date. `scheduled_date`
// is compared as YYYY-MM-DD strings (same pattern as getWeekRange above).
function getSubmissionWindow(): { start: string; end: string } {
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

// Normalise a fixture's scheduled_date (may be a full timestamp or YYYY-MM-DD)
// into a YYYY-MM-DD date key for window comparisons.
function fixtureDateKey(f: any): string {
  const raw = f?.scheduled_date
  if (!raw) return ''
  const s = String(raw)
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10)
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

// Is a date key (YYYY-MM-DD) inside the result-submission window (today-7..today)?
function isInSubmissionWindow(dateKey: string): boolean {
  if (!dateKey) return false
  const { start, end } = getSubmissionWindow()
  return dateKey >= start && dateKey <= end
}

// Whether a non-admin is currently allowed to submit the given fixture's result.
// null = allowed; otherwise a human-readable rejection reason relative to `now`.
// The window is today-7 .. today+7, so a game up to 7 days ahead is allowed
// (it will be captured as 'confirmed_pending' until the fixture date).
function submissionBlockReason(f: any, now = new Date()): string | null {
  const dateKey = fixtureDateKey(f)
  if (!dateKey) return null
  if (isInSubmissionWindow(dateKey)) return null
  const todayKey = now.toISOString().split('T')[0]
  if (dateKey > todayKey) {
    const d = new Date(`${dateKey}T00:00:00.000Z`)
    const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    return `This game is more than 7 days away, so it can't be submitted yet. Please submit the screenshot once the match is within 7 days or on the match day (${label}).`
  }
  return `This match is older than 7 days, so it can't be submitted here. Please send the screenshot on the match day.`
}

// ─── Admin phone numbers ──────────────────────────────────────────────────────────
const ADMIN_PHONES = ['+27678721810', '+27732509506', '+27734776081']
function isAdminPhone(phone: string): boolean {
  const norm = phone.replace(/\D/g, '')
  return ADMIN_PHONES.some(p => p.replace(/\D/g, '') === norm)
}

// ─── Input normalization helpers ─────────────────────────────────────────────
// Users type everything: "1", "option 1", "1 please", ""backdoor"", "i want to
// submit a backdoor". These helpers strip quotes/punctuation/filler so flows
// don't choke on extra words or characters.

function normalizeText(input: string): string {
  return input
    .trim()
    // strip any kind of quote anywhere in the message
    .replace(/["'\u201C\u201D\u2018\u2019`]/g, '')
    // drop trailing punctuation (keeps interior punctuation for team names)
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNumber(text: string): number | null {
  const m = normalizeText(text).match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

function includesWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(normalizeText(text))
}

function isCancel(text: string): boolean {
  return includesWord(text, 'cancel')
}

const YES_WORDS = [
  'yes', 'yeah', 'yep', 'y', 'ja', 'ok', 'okay', 'sure', 'confirm', 'correct',
  'right', 'go ahead', 'update', 'fine', 'good', 'submit', 'looks good',
]
const NO_WORDS = ['no', 'nah', 'nope', 'skip']

function isYes(text: string): boolean {
  const t = normalizeText(text)
  return YES_WORDS.some(w => (w.includes(' ') ? includesWord(t, w) : includesWord(t, w)))
}

function isNo(text: string): boolean {
  const t = normalizeText(text)
  return NO_WORDS.some(w => includesWord(t, w)) || includesWord(t, 'cancel')
}

// Cleans a team-name answer: strips quotes/filler so quotes or trailing
// "please"/"i want" don't break the "Team A vs Team B" split.
function cleanTeamInput(input: string): string {
  let out = normalizeText(input)
    .replace(/\s+vs\.?\s+/gi, ' vs ')
    .trim()
  // Drop lead-in filler ("i want...", "please", "the match is", "between")
  out = out.replace(/^(i want( to (submit|report|check|send))?|please|pls|the match( is)?|between)\s+/i, '')
  // Drop trailing filler
  out = out.replace(/\s+(please|pls|thanks|thank you|thank you very much|thx|a lot|for me)$/i, '')
  return out.trim()
}

// Known commands. Ordered from most specific to most generic so multi-word
// admin commands match before the generic "backdoor" keyword.
const COMMAND_PHRASES: [string, 'manager_applications' | 'backdoor_submissions' | 'backdoor_admin' | 'backdoor' | 'check_fixtures' | 'apply' | 'submit_result' | 'tournament_applications'][] = [
  ['manager applications', 'manager_applications'],
  ['manager apps', 'manager_applications'],

  ['backdoor submissions', 'backdoor_submissions'],
  ['backdoor admin', 'backdoor_admin'],
  ['check backdoor', 'backdoor'],
  ['check my backdoors', 'backdoor'],
  ['backdoor applications', 'backdoor'],
  ['backdoor apps', 'backdoor'],
  ['my backdoors', 'backdoor'],
  ['submit backdoor', 'backdoor'],
  ['submit a backdoor', 'backdoor'],
  ['backdoor', 'backdoor'],
  ['check fixtures', 'check_fixtures'],
  ['check my fixtures', 'check_fixtures'],
  ['my fixtures', 'check_fixtures'],
  ['fixtures', 'check_fixtures'],
  ['submit a result', 'submit_result'],
  ['submit result', 'submit_result'],
  ['send result', 'submit_result'],
  ['send a result', 'submit_result'],
  ['report a result', 'submit_result'],
  ['report result', 'submit_result'],
  ['apply to join', 'apply'],
  ['join efa', 'apply'],
  ['join the efa', 'apply'],
  ['i want to join', 'apply'],
  ['i want to apply', 'apply'],
  ['tournament applications', 'tournament_applications'],
  ['tournament apps', 'tournament_applications'],
  ['apply to a tournament', 'tournament_applications'],
  ['apply for a seat', 'tournament_applications'],
  ['apply for a tournament', 'tournament_applications'],
  ['open seats', 'tournament_applications'],
  ['create an efa account', 'apply'],
  ['create an account', 'apply'],
  ['register', 'apply'],
  ['apply', 'apply'],
]

function findCommandHandler(text: string): string | null {
  const t = normalizeText(text).toLowerCase()
  for (const [phrase, handler] of COMMAND_PHRASES) {
    const p = phrase.toLowerCase()
    if (new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`, 'i').test(t)) return handler
  }
  return null
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
          side: 'Screenshot received. Type the team that is not responding. Type CANCEL to stop.',
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
        await sendTextMessage(from, "Sorry, I could not read the screenshot. Please send it again.", phoneNumberId)
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
  fixtures_team_ids: string[] | null
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
  // Onboarding flow (apply command)
  onboarding_username: string | null
  // Tournament-application flow
  tourney_apply_step: 'pick_season' | 'pick_team' | 'confirm' | null
  tourney_seasons: { season_id: string; season_name: string; vacant_seats: number }[] | null
  tourney_pickable: { id: string; name: string }[] | null
  tourney_season_id: string | null
  tourney_season_name: string | null
  tourney_team_id: string | null
  tourney_team_name: string | null
  // Admin manager-assignment flow
  admin_assign_applicants: { id: string; username: string; team_name: string | null; expires_at: string | null }[] | null
  admin_assign_team_list: { id: string; name: string }[] | null
  admin_assign_selected_applicant_id: string | null
  admin_assign_selected_team_id: string | null
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
  'Opponent-not-responding reports (backdoor) are closed right now. They open on Thursday. Please try again then.'

const WELCOME_MENU =
  'Hi 👋 You are speaking to the EFA bot.\n\n' +
  'What do you need help with? Reply with a number:\n\n' +
  '1. Send a match result\n' +
  '2. Opponent did not respond, or gave you the win\n' +
  '3. Create an EFA account\n' +
  '4. Check my backdoor applications\n' +
  '5. Tournament applications'

// Footer appended to free-text "info-request" prompts (score, team names, date,
// forfeit, etc.) so a mid-flow user always has an explicit way out. Not used on
// numbered-selection menus (confirm menu, multi-match list) where the numbers
// are already taken by real actions.
const FLOW_HINT = '\n\n1. Cancel\n2. Start again'

// Footer for numbered match-selection menus, where the numbers 1..N are already
// taken by the listed matches. Cancel / start-again therefore use words instead
// of colliding numbers.
const MATCH_LIST_HINT = '\n\nReply CANCEL to stop, or START to start again.'

// Free-text info-request states where the user types a word/phrase (not a
// selection number). In these states "1" = cancel and "2" = restart are safe to
// intercept; the confirm menu (1-4) and pick-list states are deliberately absent.
const FLOW_HINT_STATES = new Set([
  'awaiting_match_name',
  'awaiting_date',
  'awaiting_edit_score',
  'awaiting_forfeit',
  'awaiting_already_submitted',
  'awaiting_backdoor_search',
  'awaiting_backdoor_side',
  'awaiting_backdoor_override_confirm',
  'awaiting_onboarding_username',
  'awaiting_fixtures_team',
  'awaiting_phone_update',
  'awaiting_phone_team_confirm',
])

// Handles the numbered "1. Cancel / 2. Start again" hint if the current session is
// in a free-text info state. Returns true if the message was consumed, false if
// the bot should continue normal processing.
async function handleFlowHint(from: string, text: string, phoneNumberId: string): Promise<boolean> {
  const trimmed = text.trim()
  if (trimmed !== '1' && trimmed !== '2') return false
  await clearSession(from)
  if (trimmed === '1') {
    await sendTextMessage(from, 'Cancelled. Send a new screenshot when you\'re ready.', phoneNumberId)
  } else {
    await sendTextMessage(from, WELCOME_MENU, phoneNumberId)
  }
  return true
}

// True when the user is asking to restart the flow on a numbered match-selection
// menu ("start", "start again", "restart", "begin", "again").
function isStartAgain(text: string): boolean {
  return (
    includesWord(text, 'start') ||
    includesWord(text, 'restart') ||
    includesWord(text, 'begin') ||
    includesWord(text, 'again')
  )
}

// For numbered match-selection menus (MATCH_LIST_HINT). Consumes a word-based
// "start again" request by clearing the session and showing the welcome menu.
// Cancel is already handled in each menu's own handler via isCancel().
async function handleStartAgain(from: string, text: string, phoneNumberId: string): Promise<boolean> {
  if (!isStartAgain(text)) return false
  await clearSession(from)
  await sendTextMessage(from, WELCOME_MENU, phoneNumberId)
  return true
}

// Shown only on initial contact (no active flow). Every mid-flow state is
// handled earlier in handleText, so this never re-triggers while the user is
// choosing options inside an existing flow.
async function handleWelcomeMenu(from: string, text: string, phoneNumberId: string) {
  const num = extractNumber(text)
  if (num === 1) {
    await sendTextMessage(from, 'Send a screenshot of your result screen and I will take it from there.', phoneNumberId)
    return
  }
  if (num === 2) {
    const supabase = await createAdminClient()
    if (!(await isBackdoorWindowEnabled(supabase))) {
      await sendTextMessage(from, BACKDOOR_DISABLED_MESSAGE, phoneNumberId)
      return
    }
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'screenshot' })
    await sendTextMessage(from, 'Send a screenshot showing that the opponent did not respond.', phoneNumberId)
    return
  }
  if (num === 3) {
    await handleOnboardingStart(from, phoneNumberId)
    return
  }
  if (num === 4) {
    await showUserBackdoorApplications(from, phoneNumberId)
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
    return
  }
  if (num === 5) {
    await handleTourneyApplyStart(from, phoneNumberId)
    return
  }
  await sendTextMessage(from, WELCOME_MENU, phoneNumberId)
}

// Deterministic re-prompt for when a user mid-flow (scores loaded) sends an
// off-topic message, instead of the vague "I only help with..." fallback.
function resultFlowReprompt(session: SessionData): string {
  if (session.state === 'awaiting_override_confirm') {
    return 'This match already has a result. Reply YES to override it, or NO to cancel.'
  }
  if (session.state === 'awaiting_forfeit' || session.state === 'awaiting_forfeit_confirm') {
    return 'Reply YES or NO.'
  }
  return '1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel'
}

async function handleBackdoorSearch(from: string, text: string, phoneNumberId: string) {
if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const searchInput = cleanTeamInput(text)
  const stripped = searchInput.replace(/\d+\s*[-:]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim()

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
    .in('status', ['scheduled', 'confirmed', 'confirmed_pending', 'awaiting_confirmation', 'completed', 'abandoned'])
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
    await sendTextMessage(from, 'Please type at least one team name. Type CANCEL to stop.', phoneNumberId)
    return
  }

  const resolvedTeams = await Promise.all(teamSearches.map((s: string) => resolveTeamName(s)))

  if (resolvedTeams.some((r: string | null) => r === null)) {
    await sendTextMessage(from, `Sorry, I could not find those teams. Please type both full team names, e.g. "Paris Saint-Germain vs Arsenal".`, phoneNumberId)
    return
  }

  const [r1, r2] = resolvedTeams as [string, string]
  const matchedFixtures = allFixtures.filter((f: any) => {
    const hName = fixtureTeamName(f, 'home').toLowerCase()
    const aName = fixtureTeamName(f, 'away').toLowerCase()
    return (hName === r1.toLowerCase() && aName === r2.toLowerCase()) || (hName === r2.toLowerCase() && aName === r1.toLowerCase())
  })

  if (matchedFixtures.length === 0) {
    await sendTextMessage(from, `No match found for that. Please check the team names and try again, or type CANCEL.`, phoneNumberId)
    await clearSession(from)
    return
  }

  const sortedForDisplay = sortFixturesForDisplay(matchedFixtures)
  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_fixture',
    displayed_fixtures: sortedForDisplay.map((f: any) => f.id),
  })

  const lines = formatFixtureListWithHeadings(sortedForDisplay)
  await sendTextMessage(from, `Found ${sortedForDisplay.length} match${sortedForDisplay.length === 1 ? '' : 'es'}:\n\n${lines}\n\nReply with the number.${MATCH_LIST_HINT}`, phoneNumberId)
}

async function handleBackdoorFixture(from: string, text: string, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  if (await handleStartAgain(from, text, phoneNumberId)) return
  const session = await getSession(from)
  if (!session?.displayed_fixtures) {
    await clearSession(from)
    await sendTextMessage(from, "Something went wrong. Please start again.", phoneNumberId)
    return
  }
  const num = extractNumber(text)
  if (num === null || num < 1 || num > session.displayed_fixtures.length) {
    await sendTextMessage(from, `Pick a number between 1 and ${session.displayed_fixtures.length}.`, phoneNumberId)
    return
  }
  const fixtureId = session.displayed_fixtures[num - 1]

  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('fixtures')
    .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), results!results_fixture_id_fkey(home_score, away_score)')
    .eq('id', fixtureId)
    .single()
  const h = fixtureTeamName(data, 'home')
  const a = fixtureTeamName(data, 'away')
  const result = data ? (Array.isArray(data.results) ? data.results[0] : data.results) : null
  const alreadyApplied = !!data && !!result && (data.status === 'confirmed' || data.status === 'confirmed_pending' || data.status === 'awaiting_confirmation' || data.status === 'completed')

  if (alreadyApplied) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_backdoor_override_confirm',
      matched_fixture_id: fixtureId,
    })
    await sendTextMessage(from, `This match has already been applied backdoor (Result: ${h} ${result?.home_score}-${result?.away_score} ${a}). Would you like to override and correct? Reply YES or NO.${FLOW_HINT}`, phoneNumberId)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor_side',
    matched_fixture_id: fixtureId,
  })

  await sendTextMessage(from, `${h} vs ${a}\n\nWho gets the 3-0 win? Type the team name (e.g. ${h} or ${a}). Type CANCEL to stop.`, phoneNumberId)
}

async function handleBackdoorOverrideConfirm(from: string, text: string, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const session = await getSession(from)
  if (!session?.matched_fixture_id) {
    await clearSession(from)
    await sendTextMessage(from, "Something went wrong. Please start again.", phoneNumberId)
    return
  }
  if (isYes(text)) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_backdoor_side',
      matched_fixture_id: session.matched_fixture_id,
    })
    const supabase = await createAdminClient()
    const { data } = await supabase
      .from('fixtures')
      .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', session.matched_fixture_id)
      .single()
    const h = fixtureTeamName(data, 'home')
    const a = fixtureTeamName(data, 'away')
    await sendTextMessage(from, `${h} vs ${a}\n\nWho gets the 3-0 win? Type the team name (e.g. ${h} or ${a}).${FLOW_HINT}`, phoneNumberId)
    return
  }
  if (isNo(text)) {
    await clearSession(from)
    await sendTextMessage(from, "OK. No changes made.", phoneNumberId)
    return
  }
  await sendTextMessage(from, 'Reply YES or NO. Type CANCEL to stop.', phoneNumberId)
}

async function handleBackdoorSide(from: string, text: string, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, "Cancelled.", phoneNumberId)
    return
  }
  const session = await getSession(from)
  if (!session?.matched_fixture_id) {
    await clearSession(from)
    await sendTextMessage(from, "Something went wrong. Please start again.", phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const side = await resolveBackdoorSide(supabase, session.matched_fixture_id, text)
  let homeScore: number, awayScore: number
  if (side === 'home') { homeScore = 3; awayScore = 0 }
  else if (side === 'away') { homeScore = 0; awayScore = 3 }
  else {
    const { data: fx } = await supabase
      .from('fixtures')
      .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', session.matched_fixture_id)
      .single()
    const h = fixtureTeamName(fx, 'home')
    const a = fixtureTeamName(fx, 'away')
    await sendTextMessage(from, `Type the team that gets the 3-0 win (e.g. ${h} or ${a}).${FLOW_HINT}`, phoneNumberId)
    return
  }

  const adminUserId = await getAdminUserId(supabase)

  // Detect if this is an override of an already-confirmed backdoor result
  const { data: existingFix } = await supabase
    .from('fixtures')
    .select('id, status, tournament_id, round_type, home_team_id, away_team_id, results!results_fixture_id_fkey(home_score, away_score)')
    .eq('id', session.matched_fixture_id)
    .single()
  const existingResult = existingFix ? (Array.isArray(existingFix.results) ? existingFix.results[0] : existingFix.results) : null
  const isOverride = !!existingFix && !!existingResult && (existingFix.status === 'confirmed' || existingFix.status === 'confirmed_pending' || existingFix.status === 'awaiting_confirmation' || existingFix.status === 'completed')

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
    ...(isOverride ? { override_reason: 'backdoor override' } : {}),
  }, { onConflict: 'fixture_id' })

  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', session.matched_fixture_id)

  // Recalculate standings so the overridden result is reflected
  if (existingFix?.tournament_id) {
    try { await recalculateStandings(existingFix.tournament_id) } catch (e) {}
  }

  if (existingFix && ['r16', 'qf', 'sf', 'final'].includes(existingFix.round_type ?? '')) {
    try {
      await advanceWinner(
        supabase,
        existingFix.tournament_id,
        session.matched_fixture_id,
        homeScore,
        awayScore,
        existingFix.home_team_id ?? null,
        existingFix.away_team_id ?? null
      )
    } catch (e) {
      console.error('[webhook] knockout progression failed:', e)
    }
  }

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

  console.log('[handleSubmissionType] session:', JSON.stringify(session))

  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  if (step === 'menu') {
    const option = extractNumber(text)
    if (option === 1) {
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
      await sendTextMessage(from, `This is a new score.\n\nWhat match is it for? Type the team names, e.g. "Arsenal vs Everton".${FLOW_HINT}`, phoneNumberId)
      return
    }
    if (option === 2) {
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
      await sendTextMessage(from, `This changes a score that was already submitted.\n\nWhat match is it for? Type the team names, e.g. "Arsenal vs Everton".${FLOW_HINT}`, phoneNumberId)
      return
    }
    await sendTextMessage(from, 'Reply 1 or 2. Type CANCEL to stop.', phoneNumberId)
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

// Compares a stored profile number against a WhatsApp `from` number. Handles SA
// local vs international ("0694021679" ↔ "27694021679") as well as generic
// international numbers from any country code.
function phoneNumbersMatch(stored: string | null | undefined, from: string): boolean {
  const a = normalizePhone(stored)
  const b = normalizePhone(from)
  if (!a || !b) return false
  if (a === b) return true
  // SA local ↔ international
  if (a.startsWith('0') && b.startsWith('27') && `27${a.slice(1)}` === b) return true
  if (b.startsWith('0') && a.startsWith('27') && `27${b.slice(1)}` === a) return true
  // Generic: local format (starts with 0) vs any international code
  if (a.startsWith('0') && !b.startsWith('0') && b.length > a.length && b.endsWith(a.slice(1))) return true
  if (b.startsWith('0') && !a.startsWith('0') && a.length > b.length && a.endsWith(b.slice(1))) return true
  return false
}

// Normalizes a stored number to international E.164 digits for the WhatsApp
// contacts API. Numbers that already carry a country code ("+27 65 261 8652",
// "+233591519713", "+38971670793") pass through unchanged; local SA numbers
// ("0795932223") get the SA country code prepended. The WhatsApp API rejects
// contact cards whose phone is not international format (error 131009).
function toInternationalPhone(n: string | null | undefined): string | null {
  let digits = normalizePhone(n)
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  // Only treat as SA local if it's exactly 10 digits starting with 0
  if (digits.startsWith('0') && digits.length === 10) return `27${digits.slice(1)}`
  return digits
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

  // If the texting number matches a manager's stored number, that manager is the
  // submitter — numbers agree, nothing to update.
  if (managers.some(m => phoneNumbersMatch(m.phone, from))) return null

  // Otherwise the submitter is a manager whose stored number is missing/different.
  const candidates = managers.filter(m => !phoneNumbersMatch(m.phone, from))

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
  const supabase = await createAdminClient()

  if (isYes(text)) {
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

  if (isNo(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'No problem. Your number stays as it is.', phoneNumberId)
    return
  }

  await sendTextMessage(from, `Update your number to ${from}? Reply YES or NO.${FLOW_HINT}`, phoneNumberId)
}

async function handlePhoneTeamConfirm(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const supabase = await createAdminClient()

  if (isCancel(text) || isNo(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'No problem. Your number stays as it is.', phoneNumberId)
    return
  }

  if (isYes(text)) {
    await sendTextMessage(from, `Which team do you manage? Reply ${(session.phone_update_candidates || []).map(c => c.teamName).join(' or ')}. Type CANCEL to skip.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const candidates: { profileId: string; teamName: string }[] = session.phone_update_candidates || []
  if (candidates.length === 0) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong. Try again later.', phoneNumberId)
    return
  }

  const lower = cleanTeamInput(text)
  const match = candidates.find(c =>
    c.teamName.toLowerCase() === lower ||
    lower.includes(c.teamName.toLowerCase()) ||
    c.teamName.toLowerCase().includes(lower),
  )

  if (!match) {
    await sendTextMessage(from, `Which team do you manage? Reply ${candidates.map(c => c.teamName).join(' or ')}. Type CANCEL to skip.${FLOW_HINT}`, phoneNumberId)
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

async function sendFixturesForTeams(from: string, teamIds: string[], teamNames: string[], dateKey: string | null, phoneNumberId: string) {
  const supabase = await createAdminClient()
  const useDate = dateKey || new Date().toISOString().slice(0, 10)
  const label = teamNames.join(' & ')

  const orParts = teamIds
    .map(id => `and(home_team_id.eq.${id},scheduled_date.eq.${useDate}),and(away_team_id.eq.${id},scheduled_date.eq.${useDate})`)
    .join(',')

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status, scheduled_date, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
    .or(orParts)
    .in('status', ['scheduled', 'confirmed', 'confirmed_pending'])
    .order('matchday', { ascending: true })
    .order('scheduled_date', { ascending: true })

  const allFixtures = (fixtures as any[]) || []
  const scheduled = allFixtures.filter(f => f.status === 'scheduled')
  const confirmed = allFixtures.filter(f => f.status === 'confirmed' || f.status === 'confirmed_pending')

  if (allFixtures.length === 0) {
    await upsertSession({ phone_number: from, pending_date: useDate })
    await sendTextMessage(from, `No fixtures found for ${label} on ${formatDateLabel(useDate)}.\n\nType a date (e.g. 15 Aug) to check another day, or type CANCEL to exit.`, phoneNumberId)
    return
  }

  // Order must match the on-screen numbering: scheduled lines first, then confirmed.
  await upsertSession({
    phone_number: from,
    pending_date: useDate,
    displayed_fixtures: [...scheduled.map(f => f.id), ...confirmed.map(f => f.id)],
  })

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

  await sendTextMessage(from, `Fixtures for ${label} on ${formatDateLabel(useDate)}:\n\n${lines.join('\n')}\n\nReply with a number to get your opponent's contact, or type a date (e.g. 15 Aug) to check fixtures for another day.${MATCH_LIST_HINT}`, phoneNumberId)
}

async function handleCheckFixturesCommand(from: string, phoneNumberId: string) {
  const supabase = await createAdminClient()

  // If the number is already on the system, identify the manager and list
  // fixtures for every team they manage — no team-name question needed.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null)

  const matchedProfile = (profiles as any[] || []).find(p => phoneNumbersMatch(p.phone, from))

  if (matchedProfile) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('manager_id', matchedProfile.id)

    const ownedTeams = (teams as any[] || [])
    if (ownedTeams.length > 0) {
      const teamIds = ownedTeams.map(t => t.id)
      const teamNames = ownedTeams.map(t => t.name)
      await upsertSession({
        phone_number: from,
        state: 'awaiting_fixtures_action',
        home_team: teamNames.join(' & '),
        team_id: teamIds.length === 1 ? teamIds[0] : null,
        fixtures_team_ids: teamIds,
        pending_date: null,
        displayed_fixtures: null,
        phone_update_profile_id: null,
        phone_update_candidates: null,
      })
      await sendFixturesForTeams(from, teamIds, teamNames, null, phoneNumberId)
      return
    }
  }

  // Number not on the system (or manages no teams) → ask which team.
  await upsertSession({
    phone_number: from,
    state: 'awaiting_fixtures_team',
    home_team: null,
    team_id: null,
    fixtures_team_ids: null,
    pending_date: null,
    displayed_fixtures: null,
    phone_update_profile_id: null,
    phone_update_candidates: null,
  })
  await sendTextMessage(from, `What is your team name? Type CANCEL to exit.${FLOW_HINT}`, phoneNumberId)
}

async function handleFixturesTeam(from: string, text: string, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const cleaned = cleanTeamInput(text)
  const teamName = await resolveTeamName(cleaned)
  if (!teamName) {
    await sendTextMessage(from, `Sorry, I could not find a team matching that. Please type the full team name. Type CANCEL to stop.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, manager:profiles!teams_manager_id_fkey(id, phone)')
    .eq('name', teamName)
    .maybeSingle()
  if (!team) {
    await sendTextMessage(from, `Sorry, I could not find a team matching that. Please type the full team name. Type CANCEL to stop.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const manager = Array.isArray(team.manager) ? team.manager[0] : team.manager
  const phoneMatches = phoneNumbersMatch(manager?.phone || null, from)

  // Number matches (or there is no manager profile to compare) → fixtures directly.
  if (!manager?.id || phoneMatches) {
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixtures_action',
      home_team: team.name,
      team_id: team.id,
      fixtures_team_ids: [team.id],
    })
    await sendFixturesForTeams(from, [team.id], [team.name], null, phoneNumberId)
    return
  }

  // Number is missing or different from what's on the system → offer to update
  // before showing the fixtures (yes updates, later skips; fixtures show either way).
  await upsertSession({
    phone_number: from,
    state: 'awaiting_fixtures_phone_confirm',
    home_team: team.name,
    team_id: team.id,
    fixtures_team_ids: [team.id],
    phone_update_profile_id: manager.id,
  })
  await sendTextMessage(from, `The number you are texting from does not match the number on the system for ${team.name}. Update? Yes or Later.`, phoneNumberId)
}

async function handleFixturesPhoneConfirm(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const supabase = await createAdminClient()

  const decline = isNo(text) || /^later$/i.test(normalizeText(text))
  const affirm = !decline && isYes(text)

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

  if (!session.fixtures_team_ids || session.fixtures_team_ids.length === 0) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_fixtures_action',
    home_team: session.home_team,
    fixtures_team_ids: session.fixtures_team_ids,
    phone_update_profile_id: null,
  })
  await sendFixturesForTeams(from, session.fixtures_team_ids, [session.home_team || 'your team'], null, phoneNumberId)
}

async function sendOpponentContact(from: string, fixtureId: string, myTeamIds: string[], phoneNumberId: string) {
  const supabase = await createAdminClient()
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone)), away_team:teams!fixtures_away_team_id_fkey(id, name, manager:profiles!teams_manager_id_fkey(id, username, phone))')
    .eq('id', fixtureId)
    .single()

  if (!fixture) {
    await sendTextMessage(from, 'Could not load that fixture. Try again.', phoneNumberId)
    return
  }

  const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
  const homeIsMine = myTeamIds.some(id => String(id) === String(fixture.home_team_id))
  const awayIsMine = myTeamIds.some(id => String(id) === String(fixture.away_team_id))
  const opponent = !homeIsMine && !awayIsMine ? homeTeam : homeIsMine && awayIsMine ? homeTeam : homeIsMine ? awayTeam : homeTeam

  if (!opponent) {
    await clearSession(from)
    await sendTextMessage(from, 'Could not find the opponent for that fixture.', phoneNumberId)
    return
  }

  const manager = Array.isArray(opponent.manager) ? opponent.manager[0] : opponent.manager
  const phoneRaw = manager?.phone || null
  const phone = toInternationalPhone(phoneRaw)

  if (!phone) {
    await clearSession(from)
    await sendTextMessage(from, `No contact number is saved for ${opponent.name} yet.`, phoneNumberId)
    return
  }

  const sent = await sendContactMessage(from, { formattedName: opponent.name, phone }, phoneNumberId)
  if (!sent) {
    await sendTextMessage(from, `Here is ${opponent.name}'s number: +${phone}`, phoneNumberId)
  }
  await clearSession(from)
}

async function handleFixturesAction(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  if (await handleStartAgain(from, text, phoneNumberId)) return

  // A date (e.g. "15 Aug" or "tomorrow") must be checked BEFORE number
  // extraction, otherwise "15 Aug" would be treated as fixture number 15.
  const parsed = parseUserDate(text)
  if (parsed) {
    if (!session.fixtures_team_ids || session.fixtures_team_ids.length === 0) {
      await clearSession(from)
      await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
      return
    }
    await sendFixturesForTeams(from, session.fixtures_team_ids, [session.home_team || 'your team'], parsed.dateKey, phoneNumberId)
    return
  }

  const num = extractNumber(text)
  if (num !== null && session.displayed_fixtures && num >= 1 && num <= session.displayed_fixtures.length) {
    if (!session.fixtures_team_ids || session.fixtures_team_ids.length === 0) {
      await clearSession(from)
      await sendTextMessage(from, 'Something went wrong. Type "check fixtures" to start again.', phoneNumberId)
      return
    }
    await sendOpponentContact(from, session.displayed_fixtures[num - 1], session.fixtures_team_ids, phoneNumberId)
    return
  }

  await sendTextMessage(from, `Reply with a number from the list to get your opponent's contact, or type a date (e.g. 15 Aug) to check fixtures for another day.${MATCH_LIST_HINT}`, phoneNumberId)
}

// ─── Backdoor User Flow ──────────────────────────────────────────────────────────

async function handleBackdoorFlow(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const step = session.backdoor_menu_step

  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  if (step === 'menu') {
    const option = extractNumber(text)
    if (option === 1) {
      const supabase = await createAdminClient()
      if (!(await isBackdoorWindowEnabled(supabase))) {
        await sendTextMessage(from, BACKDOOR_DISABLED_MESSAGE, phoneNumberId)
        return
      }
      await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'screenshot' })
      await sendTextMessage(from, 'Send a screenshot showing that the opponent did not respond.', phoneNumberId)
      return
    }
    if (option === 2) {
      await showUserBackdoorApplications(from, phoneNumberId)
      await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
      return
    }
    await sendTextMessage(from, 'Reply 1 or 2. Type CANCEL to stop.', phoneNumberId)
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
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const searchInput = cleanTeamInput(text)

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
    await sendTextMessage(from, 'Please type at least one team name. Type CANCEL to stop.', phoneNumberId)
    return
  }

  // Resolve team names using database aliases
  const resolvedTeams = await Promise.all(
    teamSearches.map(s => resolveTeamName(s))
  )
  
  if (resolvedTeams.some(r => r === null)) {
    await sendTextMessage(from, `Sorry, I could not find those teams. Please type both full team names, e.g. "Paris Saint-Germain vs Arsenal".`, phoneNumberId)
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
    await sendTextMessage(from, `No match found for that. Please type both full team names, e.g. "Arsenal vs Everton", or type CANCEL to stop.`, phoneNumberId)
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

    await sendTextMessage(from, `${hName} vs ${aName}\n\nWho is not responding? Type the team name (e.g. ${hName} or ${aName}). Type CANCEL to stop.`, phoneNumberId)
    return
  }

  // Multiple matches
  await upsertSession({
    phone_number: from,
    state: 'awaiting_backdoor',
    backdoor_menu_step: 'fixture_select',
    backdoor_fixture_ids: matchedFixtures.map((f: any) => f.id),
  })

  await sendTextMessage(from, `Found ${matchedFixtures.length} matches:\n\n${formatFixtureListWithHeadings(matchedFixtures)}\n\nReply with the number of your match.${MATCH_LIST_HINT}`, phoneNumberId)
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
    if (f.status === 'confirmed' || f.status === 'confirmed_pending') {
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
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  if (await handleStartAgain(from, text, phoneNumberId)) return
  const num = extractNumber(text)
  if (num === null || num < 1 || num > (session.backdoor_fixture_ids?.length || 0)) {
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

  await sendTextMessage(from, `${h} vs ${a}\n\nWho is not responding? Type the team name (e.g. ${h} or ${a}). Type CANCEL to stop.`, phoneNumberId)
}

// Resolve the team the manager typed into a home/away side for the given
// fixture. Still accepts "home"/"away" for backwards compatibility; otherwise
// matches the team name (exact, then via aliases/LLM). Returns null if no match.
async function resolveBackdoorSide(
  supabase: any,
  fixtureId: string | null,
  text: string
): Promise<'home' | 'away' | null> {
  const input = cleanTeamInput(text)
  if (input === 'home') return 'home'
  if (input === 'away') return 'away'
  if (!fixtureId) return null

  const { data: f } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .eq('id', fixtureId)
    .single()

  const homeName = fixtureTeamName(f, 'home').toLowerCase()
  const awayName = fixtureTeamName(f, 'away').toLowerCase()
  if (homeName && input === homeName) return 'home'
  if (awayName && input === awayName) return 'away'

  const resolved = await resolveTeamName(input)
  if (resolved) {
    const r = resolved.toLowerCase()
    if (r === homeName) return 'home'
    if (r === awayName) return 'away'
  }
  return null
}

async function handleBackdoorSideSelect(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  const supabase = await createAdminClient()
  const side = await resolveBackdoorSide(supabase, session.matched_fixture_id, text)
  if (!side) {
    const { data: f } = await supabase
      .from('fixtures')
      .select('home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', session.matched_fixture_id)
      .single()
    const h = fixtureTeamName(f, 'home')
    const a = fixtureTeamName(f, 'away')
    await sendTextMessage(from, `Type the team that's not responding (e.g. ${h} or ${a}).`, phoneNumberId)
    return
  }

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
      const side = subs[0].side_claimed === 'home' ? awayName : homeName
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
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  const num = extractNumber(text)
  if (num === null || num < 1 || num > (session.displayed_fixtures?.length || 0)) {
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
    const side = s.side_claimed === 'home' ? 'Away' : 'Home'
    await sendTextMessage(from, `Submission by ${s.submitter_phone} (${side} team):\nScreenshot: ${s.screenshot_url}`, phoneNumberId)
  }

  await sendTextMessage(from, 'Approve or decline? Reply "approve" or "decline".', phoneNumberId)
}

async function handleBackdoorAdminDecision(from: string, text: string, session: SessionData, phoneNumberId: string) {
  const approve = includesWord(text, 'approve')
  if (!approve && !includesWord(text, 'decline')) {
    await sendTextMessage(from, 'Reply "approve" or "decline".', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const submissionIds = session.backdoor_fixture_ids || []
  const fixtureId = session.matched_fixture_id

  if (approve) {
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
      // One submitted -> 3-0 to the OPPOSITE side of side_claimed
      // (side_claimed is the non-responding team, which gets the loss).
      if (submissions[0].side_claimed === 'home') {
        homeScore = 0; awayScore = 3
      } else {
        homeScore = 3; awayScore = 0
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
    const { data: fixData } = await supabase.from('fixtures').select('tournament_id, round_type, home_team_id, away_team_id').eq('id', fixtureId).single()
    if (fixData?.tournament_id) {
      try { await recalculateStandings(fixData.tournament_id) } catch (e) {}
    }

    if (fixtureId && fixData?.tournament_id && ['r16', 'qf', 'sf', 'final'].includes(fixData.round_type ?? '')) {
      try {
        await advanceWinner(
          supabase,
          fixData.tournament_id,
          fixtureId,
          homeScore,
          awayScore,
          fixData.home_team_id ?? null,
          fixData.away_team_id ?? null
        )
      } catch (e) {
        console.error('[webhook] knockout progression failed:', e)
      }
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

// ─── Onboarding (apply command) ─────────────────────────────────────────────

const ONBOARDING_LOGIN_URL = 'https://efa-fxyk.vercel.app/login'
const EFA_WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/FPk19G6cr9D4dDE07HHC7T'
const DEFAULT_USER_PASSWORD = 'Efootball@2026'
const APPLICATION_TTL_DAYS = 7

async function handleOnboardingStart(from: string, phoneNumberId: string) {
  const supabase = await createAdminClient()

  // If this phone already belongs to a profile, tell them they're registered.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, phone')
  const alreadyRegistered = (profiles ?? []).some((p: any) =>
    phoneNumbersMatch(p.phone, from)
  )

  if (alreadyRegistered) {
    await sendTextMessage(
      from,
      `You already have an EFA account. Login here: ${ONBOARDING_LOGIN_URL}`,
      phoneNumberId
    )
    return
  }

  await upsertSession({ phone_number: from, state: 'awaiting_onboarding_username' })
  await sendTextMessage(
    from,
    'Welcome to EFA! To create your account, reply with the username you want (letters, numbers and underscores only). Type CANCEL to exit.',
    phoneNumberId
  )
}

async function handleOnboardingUsername(from: string, text: string, phoneNumberId: string) {
  if (/^cancel$/i.test(text.trim())) {
    await clearSession(from)
    await sendTextMessage(from, 'No problem. Send "apply" whenever you are ready to join.', phoneNumberId)
    return
  }
  if (/^(apply|apply to join|join efa|i want to join|join the efa)$/i.test(text.trim())) {
    await sendTextMessage(from, `Reply with the username you want (letters, numbers and underscores only). Type CANCEL to exit.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const username = text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (username.length < 3 || username.length > 30) {
    await sendTextMessage(from, `Username must be between 3 and 30 characters (letters, numbers, underscores). Try again or type CANCEL.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const supabase = await createAdminClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle()

  if (existing) {
    await sendTextMessage(from, `The username "@${username}" is already taken. Pick another one or type CANCEL.${FLOW_HINT}`, phoneNumberId)
    return
  }

  const email = `${username}@efa.local`
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  })

  if (createError || !created.user) {
    console.error('[webhook] onboarding createUser failed:', createError?.message)
    await clearSession(from)
    await sendTextMessage(from, 'Sorry, something went wrong creating your account. Please try again later.', phoneNumberId)
    return
  }

  const profileId = created.user.id

  // The on_auth_user_created trigger creates the profile; insert defensively if needed.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (!profile) {
    await supabase.from('profiles').insert({ id: profileId, username, phone: from })
  } else {
    await supabase.from('profiles').update({ phone: from }).eq('id', profileId)
  }

  // Record the onboarding application (expires in 7 days, no team yet)
  const { error: appError } = await supabase.from('manager_applications').insert({
    applicant_id: profileId,
    team_id: null,
    status: 'pending',
    expires_at: new Date(Date.now() + APPLICATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (appError) console.error('[webhook] onboarding application insert failed:', appError.message)

  await upsertSession({ phone_number: from, state: 'idle', onboarding_username: username })
  await sendTextMessage(
    from,
    `Your EFA account is ready!\n\nUsername: ${username}\nPassword: ${DEFAULT_USER_PASSWORD}\n\nLogin here: ${ONBOARDING_LOGIN_URL}\n\nJoin the WhatsApp group: ${EFA_WHATSAPP_GROUP_URL}\n\nYour application has been submitted and stays valid for ${APPLICATION_TTL_DAYS} days.`,
    phoneNumberId
  )
}

// ─── WhatsApp: tournament (season) applications ─────────────────────────────

async function resolveProfileByPhone(from: string): Promise<{ id: string; username: string; sacked_at: string | null } | null> {
  const supabase = await createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, phone, sacked_at')
  const profile = (profiles ?? []).find(
    (p: any) => phoneNumbersMatch(p.phone, from)
  )
  if (!profile) return null
  return { id: profile.id as string, username: (profile.username ?? 'player') as string, sacked_at: profile.sacked_at ?? null }
}

async function handleTourneyApplyStart(from: string, phoneNumberId: string) {
  const profile = await resolveProfileByPhone(from)
  if (!profile) {
    await sendTextMessage(
      from,
      'You need an EFA account to apply for a tournament. Reply 3 to create one from the menu, or login at https://efa-fxyk.vercel.app/login',
      phoneNumberId
    )
    return
  }

  const supabase = await createAdminClient()

  // Show any pending applications first
  const { data: pending } = await supabase
    .from('tournament_applications')
    .select('id, season_id, status, season:season_id(name), created_at')
    .eq('applicant_id', profile.id)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })

  if ((pending ?? []).length > 0) {
    const lines = (pending ?? []).map((a: any) => {
      const season = Array.isArray(a.season) ? a.season[0] : a.season
      return a.status === 'pending'
        ? `⏳ ${season?.name ?? 'Season'} — pending review`
        : `✅ ${season?.name ?? 'Season'} — approved`
    })
    await sendTextMessage(
      from,
      `Your tournament applications:\n\n${lines.join('\n')}`,
      phoneNumberId
    )
  }

  const open = await listOpenSeasons(supabase)

  if (open.length === 0) {
    await sendTextMessage(
      from,
      'There are no open seats in any season right now. Seats open automatically when a manager leaves or transfers.',
      phoneNumberId
    )
    await clearSession(from)
    return
  }

  const lines = open.map((s, i) => `${i + 1}. ${s.season_name} (${s.vacant_seats} seat${s.vacant_seats === 1 ? '' : 's'} open)`)
  await upsertSession({
    phone_number: from,
    state: 'awaiting_tourney_apply',
    tourney_apply_step: 'pick_season',
    tourney_seasons: open.map((s) => ({ season_id: s.season_id, season_name: s.season_name, vacant_seats: s.vacant_seats })),
    tourney_pickable: null,
    tourney_team_name: null,
  })
  await sendTextMessage(
    from,
    `Which tournament do you want to join?\n\n${lines.join('\n')}\n\nReply with a number, or type CANCEL.`,
    phoneNumberId
  )
}

async function handleTourneyApplyReply(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const profile = await resolveProfileByPhone(from)
  if (!profile) {
    await clearSession(from)
    await sendTextMessage(from, 'You need an EFA account for that.', phoneNumberId)
    return
  }

  const step = session.tourney_apply_step

  if (step === 'pick_season') {
    const num = extractNumber(text)
    const seasons = session.tourney_seasons ?? []
    if (num === null || num < 1 || num > seasons.length) {
      await sendTextMessage(from, 'Reply with a valid number from the list, or type CANCEL.', phoneNumberId)
      return
    }
    const picked = seasons[num - 1]

    const pickable = await getSeasonPickableTeams(supabase, picked.season_id)
    if (pickable.length === 0) {
      await sendTextMessage(from, 'That season has no unmanaged clubs available right now. Pick another season or type CANCEL.', phoneNumberId)
      return
    }

    await upsertSession({
      phone_number: from,
      state: 'awaiting_tourney_apply',
      tourney_apply_step: 'pick_team',
      tourney_seasons: seasons,
      tourney_season_id: picked.season_id,
      tourney_season_name: picked.season_name,
      tourney_pickable: pickable.map((t) => ({ id: t.id, name: t.name })),
      tourney_team_name: null,
    })

    const lines = pickable.map((t, i) => `${i + 1}. ${t.name}`)
    await sendTextMessage(
      from,
      `Which club do you want to manage in ${picked.season_name}?\n\n${lines.join('\n')}\n\nReply with a number, or type CANCEL.`,
      phoneNumberId
    )
    return
  }

  if (step === 'pick_team') {
    const num = extractNumber(text)
    const pickable = session.tourney_pickable ?? []
    if (num === null || num < 1 || num > pickable.length) {
      await sendTextMessage(from, 'Reply with a valid number from the list, or type CANCEL.', phoneNumberId)
      return
    }
    const picked = pickable[num - 1]
    await upsertSession({
      phone_number: from,
      state: 'awaiting_tourney_apply',
      tourney_apply_step: 'confirm',
      tourney_pickable: pickable,
      tourney_team_id: picked.id,
      tourney_team_name: picked.name,
    })
    await sendTextMessage(
      from,
      `You are applying to join ${session.tourney_season_name ?? 'the season'} as manager of ${picked.name}.\n\nReply 1 to confirm, 2 to pick another club, or CANCEL to stop.${FLOW_HINT}`,
      phoneNumberId
    )
    return
  }

  if (step === 'confirm') {
    const num = extractNumber(text)
    if (num === 2) {
      const pickable = session.tourney_pickable ?? []
      const lines = pickable.map((t, i) => `${i + 1}. ${t.name}`)
      await upsertSession({
        phone_number: from,
        state: 'awaiting_tourney_apply',
        tourney_apply_step: 'pick_team',
        tourney_pickable: pickable,
      })
      await sendTextMessage(from, `Pick a club:\n\n${lines.join('\n')}\n\nReply with a number, or type CANCEL.`, phoneNumberId)
      return
    }
    if (num !== 1) {
      await sendTextMessage(from, `Reply 1 to confirm, 2 to pick another club, or CANCEL to stop.${FLOW_HINT}`, phoneNumberId)
      return
    }

    const seasonId = session.tourney_season_id
    const teamId = session.tourney_team_id
    if (!seasonId || !teamId) {
      await clearSession(from)
      await sendTextMessage(from, 'Something went wrong. Start again from the menu.', phoneNumberId)
      return
    }

    // Guard: season still open, user not already in, no duplicate application
    const open = await listOpenSeasons(supabase)
    if (!open.some((s) => s.season_id === seasonId)) {
      await clearSession(from)
      await sendTextMessage(from, 'That season is no longer accepting applications. Try again later.', phoneNumberId)
      return
    }
    const inSeason = await userInSeason(supabase, seasonId, profile.id)
    if (inSeason) {
      await clearSession(from)
      await sendTextMessage(from, 'You are already in that season.', phoneNumberId)
      return
    }
    const { data: dup } = await supabase
      .from('tournament_applications')
      .select('id')
      .eq('applicant_id', profile.id)
      .eq('season_id', seasonId)
      .eq('status', 'pending')
    if ((dup ?? []).length > 0) {
      await clearSession(from)
      await sendTextMessage(from, 'You already have a pending application for that season.', phoneNumberId)
      return
    }
    const { data: teamRow } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .is('manager_id', null)
      .maybeSingle()
    if (!teamRow) {
      await clearSession(from)
      await sendTextMessage(from, 'That club is no longer available. Pick another one — start again from the menu.', phoneNumberId)
      return
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await supabase.from('tournament_applications').insert({
      season_id: seasonId,
      applicant_id: profile.id,
      team_id: teamId,
      status: 'pending',
      expires_at: expiresAt,
    })
    if (insertErr) {
      console.error('[webhook] tournament_application insert failed:', insertErr.message)
      await clearSession(from)
      await sendTextMessage(from, 'Sorry, something went wrong submitting your application. Try again later.', phoneNumberId)
      return
    }

    // Notify admins of the new application
    try {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      const { insertNotificationsAndPush } = await import('@/lib/notify')
      await insertNotificationsAndPush(
        supabase,
        (admins ?? []).map((a: any) => ({
          user_id: a.id,
          type: 'tournament_application',
          title: 'New tournament application',
          body: `@${profile.username} applied for ${session.tourney_team_name} in ${session.tourney_season_name}.`,
          data: { season_id: seasonId, applicant_id: profile.id, team_name: session.tourney_team_name },
        }))
      )
    } catch (e) {
      console.error('[webhook] notify admins of tournament application failed:', e)
    }

    await clearSession(from)
    await sendTextMessage(
      from,
      `Application submitted ✅\n\n@${profile.username} → ${session.tourney_team_name} in ${session.tourney_season_name}.\n\nThe admins will review it. You will get a notification when a decision is made.`,
      phoneNumberId
    )
    return
  }

  await sendTextMessage(from, 'Reply with a number from the list, or type CANCEL.', phoneNumberId)
}

// ─── Admin: manager applications assignment flow ────────────────────────────

async function handleManagerApplicationsStart(from: string, phoneNumberId: string) {
  if (!isAdminPhone(from)) {
    await sendTextMessage(from, 'Admin only.', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()

  const { data: apps } = await supabase
    .from('manager_applications')
    .select(`
      id, team_id, expires_at, created_at,
      applicant:profiles!manager_applications_applicant_id_fkey(id, username),
      team:teams!manager_applications_team_id_fkey(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const now = Date.now()
  const active = (apps ?? []).filter((a: any) => {
    if (!a.expires_at) return true
    return new Date(a.expires_at).getTime() > now
  })

  if (active.length === 0) {
    await sendTextMessage(from, 'No pending manager applications right now.', phoneNumberId)
    return
  }

  const applicantList = active.map((a: any) => {
    const applicant = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant
    const team = Array.isArray(a.team) ? a.team[0] : a.team
    return {
      id: a.id as string,
      username: (applicant?.username ?? 'Unknown') as string,
      team_name: (team?.name ?? null) as string | null,
      expires_at: (a.expires_at ?? null) as string | null,
    }
  })

  await upsertSession({
    phone_number: from,
    state: 'awaiting_admin_assign_applicant',
    admin_assign_applicants: applicantList,
  })

  const lines = applicantList.map((a, i) => {
    const teamLabel = a.team_name ? ` wants ${a.team_name}` : ' (no team yet)'
    return `${i + 1}. @${a.username}${teamLabel}`
  })

  await sendTextMessage(
    from,
    `Pending Manager Applications:\n\n${lines.join('\n')}\n\nReply with a number to assign a team. Type CANCEL.`,
    phoneNumberId
  )
}

import { isAllowedTeam } from '@/lib/allowed-teams'

async function getTeamsForAssignment(supabase: any): Promise<{ id: string; name: string }[]> {
  const teamMap = new Map<string, { name: string; folder: string; slug: string }>()

  // Teams in active tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id')
    .eq('status', 'active')

  if (tournaments?.length) {
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('team_id, team:teams(id, name, logo_league_folder, logo_team_slug)')
      .in('tournament_id', tournaments.map((t: any) => t.id))

    for (const p of participants ?? []) {
      const team = Array.isArray(p.team) ? p.team[0] : p.team
      if (team?.id && team?.name && team?.logo_league_folder && team?.logo_team_slug)
        teamMap.set(team.id, { name: team.name, folder: team.logo_league_folder, slug: team.logo_team_slug })
    }
  }

  // Teams that lost via backdoor in the last 7 days (now available)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: backdoorSubs } = await supabase
    .from('backdoor_submissions')
    .select(`
      side_claimed,
      fixture:fixtures(
        id, home_team_id, away_team_id, 
        home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug), 
        away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
      )
    `)
    .eq('status', 'approved')
    .gte('reviewed_at', cutoff)

  for (const s of backdoorSubs ?? []) {
    const fixture = Array.isArray(s.fixture) ? s.fixture[0] : s.fixture
    if (!fixture) continue
    const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
    const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
    const loserId = s.side_claimed === 'home' ? fixture.home_team_id : fixture.away_team_id
    const loser = loserId === home?.id ? home : away
    if (loser?.id && loser?.name && loser?.logo_league_folder && loser?.logo_team_slug)
      teamMap.set(loser.id, { name: loser.name, folder: loser.logo_league_folder, slug: loser.logo_team_slug })
  }

  return Array.from(teamMap.entries())
    .filter(([id, data]) => isAllowedTeam(data.folder, data.slug))
    .map(([id, data]) => ({ id, name: data.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30)
}

async function handleManagerApplicationsApplicant(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const applicants = session.admin_assign_applicants ?? []
  const num = extractNumber(text)
  if (num === null || num < 1 || num > applicants.length) {
    await sendTextMessage(from, `Pick a number between 1 and ${applicants.length}. Type CANCEL.`, phoneNumberId)
    return
  }

  const selected = applicants[num - 1]
  const supabase = await createAdminClient()
  const teams = await getTeamsForAssignment(supabase)

  if (teams.length === 0) {
    await sendTextMessage(from, 'No teams available to assign right now.', phoneNumberId)
    return
  }

  await upsertSession({
    phone_number: from,
    state: 'awaiting_admin_assign_team',
    admin_assign_selected_applicant_id: selected.id,
    admin_assign_team_list: teams,
  })

  const lines = teams.map((t, i) => `${i + 1}. ${t.name}`).join('\n')
  await sendTextMessage(
    from,
    `Assign @${selected.username} to which team?\n\n${lines}\n\nReply with a number. Type CANCEL.`,
    phoneNumberId
  )
}

async function handleManagerApplicationsTeam(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }

  const teams = session.admin_assign_team_list ?? []
  const num = extractNumber(text)
  if (num === null || num < 1 || num > teams.length) {
    await sendTextMessage(from, `Pick a number between 1 and ${teams.length}. Type CANCEL.`, phoneNumberId)
    return
  }

  const selectedTeam = teams[num - 1]
  const applicant = (session.admin_assign_applicants ?? []).find((a) => a.id === session.admin_assign_selected_applicant_id)

  await upsertSession({
    phone_number: from,
    state: 'awaiting_admin_assign_confirm',
    admin_assign_selected_team_id: selectedTeam.id,
  })

  await sendTextMessage(
    from,
    `Assign @${applicant?.username ?? 'user'} to ${selectedTeam.name}? Reply yes or no. Type CANCEL.`,
    phoneNumberId
  )
}

async function handleManagerApplicationsConfirm(from: string, text: string, session: SessionData, phoneNumberId: string) {
  if (isCancel(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled.', phoneNumberId)
    return
  }
  if (isNo(text)) {
    await clearSession(from)
    await sendTextMessage(from, 'Cancelled. No changes made.', phoneNumberId)
    return
  }
  if (!isYes(text)) {
    await sendTextMessage(from, 'Reply yes or no. Type CANCEL to stop.', phoneNumberId)
    return
  }

  const applicationId = session.admin_assign_selected_applicant_id
  const teamId = session.admin_assign_selected_team_id

  if (!applicationId || !teamId) {
    await clearSession(from)
    await sendTextMessage(from, 'Something went wrong. Try again.', phoneNumberId)
    return
  }

  const supabase = await createAdminClient()
  const adminId = await getAdminProfileIdByPhone(supabase, from)
  const result = await applyManagerAssignment(supabase, applicationId, teamId, adminId)

  await clearSession(from)

  if (!result.success) {
    await sendTextMessage(from, result.message, phoneNumberId)
    return
  }

  await sendTextMessage(from, `Done. ${result.message}`, phoneNumberId)
}

async function getAdminProfileIdByPhone(supabase: any, from: string): Promise<string | null> {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, phone')
    .eq('role', 'admin')

  const match = (admins ?? []).find((a: any) =>
    phoneNumbersMatch(a.phone, from)
  )
  return match?.id ?? null
}

async function applyManagerAssignment(
  supabase: any,
  applicationId: string,
  teamId: string,
  adminId: string | null
): Promise<{ success: boolean; message: string }> {
  const [{ data: app }, { data: team }] = await Promise.all([
    supabase
      .from('manager_applications')
      .select(`
        id, applicant_id, team_id, status,
        applicant:profiles!manager_applications_applicant_id_fkey(id, username, sacked_at)
      `)
      .eq('id', applicationId)
      .single(),
    supabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .eq('id', teamId)
      .single(),
  ])

  if (!app || !team) return { success: false, message: 'Application or team not found.' }
  if (app.status !== 'pending') return { success: false, message: 'That application is no longer pending.' }

  const applicant = Array.isArray(app.applicant) ? app.applicant[0] : app.applicant
  const newManagerId: string = app.applicant_id

  // 1-week reassignment cooldown after a sacking
  if (applicant?.sacked_at) {
    const cooldownEnds = new Date(new Date(applicant.sacked_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    if (cooldownEnds.getTime() > Date.now()) {
      return {
        success: false,
        message: `@${applicant.username} was recently sacked. They can be reassigned from ${cooldownEnds.toISOString()}.`,
      }
    }
  }

  // All sibling rows for the target club (same club across phases)
  let allClubIds: string[] = [teamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await supabase
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', teamId)
    allClubIds = [teamId, ...(siblings ?? []).map((s: any) => s.id)]
  }

  const now = new Date().toISOString()

  // Release any other clubs the applicant currently manages
  const { data: managedTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_id', newManagerId)

  const previousClubIds = (managedTeams ?? [])
    .map((t: any) => t.id)
    .filter((id: string) => !allClubIds.includes(id))

  if (previousClubIds.length > 0) {
    await supabase.from('teams').update({ manager_id: null }).in('id', previousClubIds)
    await supabase
      .from('manager_tenures' as any)
      .update({ ended_at: now })
      .in('team_id', previousClubIds)
      .is('ended_at', null)
  }

  // Close the target club's open tenures and assign the new manager
  await supabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  const { error: assignErr } = await supabase
    .from('teams')
    .update({ manager_id: newManagerId })
    .in('id', allClubIds)
  if (assignErr) return { success: false, message: 'Failed to assign team: ' + assignErr.message }

  await supabase.from('manager_tenures' as any).insert(
    allClubIds.map((id) => ({
      team_id: id,
      manager_id: newManagerId,
      manager_username: applicant?.username ?? 'unknown',
      started_at: now,
    }))
  )

  // Mark this application approved (with the chosen team)
  await supabase
    .from('manager_applications')
    .update({ status: 'approved', team_id: teamId, reviewed_at: now, reviewed_by: adminId })
    .eq('id', applicationId)

  // Deny the applicant's other pending applications
  await supabase
    .from('manager_applications')
    .update({ status: 'denied', reviewed_at: now, reviewed_by: adminId })
    .eq('applicant_id', newManagerId)
    .eq('status', 'pending')
    .neq('id', applicationId)

  // Deny other pending applications for the same team
  await supabase
    .from('manager_applications')
    .update({ status: 'denied', reviewed_at: now, reviewed_by: adminId })
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .neq('id', applicationId)

  // Notifications
  const notifications: any[] = [
    {
      user_id: newManagerId,
      type: 'application_approved',
      title: 'Application Approved!',
      body: `You are now the manager of ${team.name}. Good luck!`,
      data: { team_id: teamId, team_name: team.name },
    },
  ]

  if (team.manager_id && team.manager_id !== newManagerId) {
    notifications.push({
      user_id: team.manager_id,
      type: 'manager_sacked',
      title: 'Removed as Manager',
      body: `You have been replaced as manager of ${team.name}.`,
      data: { team_id: teamId, team_name: team.name },
    })
  }

  try {
    await insertNotificationsAndPush(supabase, notifications)
  } catch (e) {
    console.error('[webhook] assign notify failed:', e)
  }

  try {
    await supabase.from('audit_log').insert({
      admin_id: adminId ?? '00000000-0000-0000-0000-000000000000',
      action: 'approve_manager_application',
      target_type: 'team',
      target_id: teamId,
      details: {
        team_name: team.name,
        new_manager_id: newManagerId,
        new_manager_username: applicant?.username ?? '',
        previous_manager_id: team.manager_id ?? null,
        source: 'whatsapp',
      },
    })
  } catch (e) {
    console.error('[webhook] assign audit log failed:', e)
  }

  return { success: true, message: `@${applicant?.username ?? 'user'} is now the manager of ${team.name}.` }
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

  await sendTextMessage(from, `Forfeit applied. Confirm result: ${hName} ${newHomeScore}-${newAwayScore} ${aName} (forfeited)?\n\n1. Submit result\n4. Cancel`, phoneNumberId)
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
  if (result && (f.status === 'confirmed' || f.status === 'confirmed_pending' || f.status === 'awaiting_confirmation')) {
    line = `${index + 1}. ${hN} ${result.home_score} - ${result.away_score} ${aN}`
  } else {
    line = `${index + 1}. ${hN} vs ${aN}`
  }
  return `${line}${date ? ` - ${date}` : ''}${tournament ? ` - ${tournament}` : ''}${result && (f.status === 'confirmed' || f.status === 'confirmed_pending' || f.status === 'awaiting_confirmation') ? ' (SUBMITTED)' : ''}`
}

function isFixtureConfirmed(f: any): boolean {
  return f.status === 'confirmed' || f.status === 'confirmed_pending' || f.status === 'awaiting_confirmation'
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

  // ─── Numbered "1. Cancel / 2. Start again" hint (free-text info states) ──
  if (session && FLOW_HINT_STATES.has(session.state)) {
    if (await handleFlowHint(from, text, phoneNumberId)) {
      return
    }
  }

  // ─── Onboarding flow ──────────────────────────────────────────────────────
  if (session?.state === 'awaiting_onboarding_username') {
    await handleOnboardingUsername(from, text, phoneNumberId)
    return
  }
  // ─── Tournament-application flow ───────────────────────────────────────────
  if (session?.state === 'awaiting_tourney_apply') {
    await handleTourneyApplyReply(from, text, session, phoneNumberId)
    return
  }
  // ─── Admin: manager assignment flow ───────────────────────────────────────
  if (session?.state === 'awaiting_admin_assign_applicant') {
    await handleManagerApplicationsApplicant(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_admin_assign_team') {
    await handleManagerApplicationsTeam(from, text, session, phoneNumberId)
    return
  }
  if (session?.state === 'awaiting_admin_assign_confirm') {
    await handleManagerApplicationsConfirm(from, text, session, phoneNumberId)
    return
  }

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
  if (session?.state === 'awaiting_backdoor_override_confirm') {
    await handleBackdoorOverrideConfirm(from, text, phoneNumberId)
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
  // ─── Commands (keyword-tolerant: quotes, extra words and punctuation are stripped) ──
  // Ordered most-specific first so multi-word admin commands win over "backdoor".
  const command = findCommandHandler(text)
  if (command === 'check_fixtures') {
    await handleCheckFixturesCommand(from, phoneNumberId)
    return
  }
  if (command === 'backdoor_submissions') {
    if (!isAdminPhone(from)) {
      await sendTextMessage(from, 'Admin only.', phoneNumberId)
      return
    }
    await showBackdoorSubmissionsForReview(from, phoneNumberId)
    return
  }
  if (command === 'backdoor_admin') {
    if (!isAdminPhone(from)) {
      await sendTextMessage(from, 'Admin only.', phoneNumberId)
      return
    }
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor_search' })
    await sendTextMessage(from, `Type the fixture, e.g. "Arsenal vs Chelsea".${FLOW_HINT}`, phoneNumberId)
    return
  }
  if (command === 'backdoor') {
    await upsertSession({ phone_number: from, state: 'awaiting_backdoor', backdoor_menu_step: 'menu' })
    await sendTextMessage(from,
      'Opponent not responding (backdoor win)\n\n' +
      '1. Report an opponent who did not respond\n' +
      '2. Check my reports\n\n' +
      'Reply 1 or 2. Type CANCEL to stop.',
      phoneNumberId
    )
    return
  }
  // ─── Onboarding command (new players) ───────────────────────────────────────
  if (command === 'apply') {
    await handleOnboardingStart(from, phoneNumberId)
    return
  }
  // ─── Tournament (season) applications command ───────────────────────────────
  if (command === 'tournament_applications') {
    await handleTourneyApplyStart(from, phoneNumberId)
    return
  }
  // ─── Admin: manager applications command ────────────────────────────────────
  if (command === 'manager_applications') {
    await handleManagerApplicationsStart(from, phoneNumberId)
    return
  }
  if (command === 'submit_result') {
    await sendTextMessage(from, 'Send a screenshot of your result screen and I will take it from there.', phoneNumberId)
    return
  }
  // ─── Submission type selection (after screenshot OCR) ────────────────────────
  if (session?.state === 'awaiting_submission_type') {
    await handleSubmissionType(from, text, session, phoneNumberId)
    return
  }
  // ─── Match name search (after screenshot) ────────────────────────────────
  if (session?.state === 'awaiting_match_name') {
    if (isCancel(text)) {
      await clearSession(from)
      await sendTextMessage(from, "OK. Send a new screenshot when you're ready.", phoneNumberId)
      return
    }
    const supabase = await createAdminClient()
    const searchInput = cleanTeamInput(text)

    // Strip any score patterns (e.g. "3-2", "3:2", "3 2") so users can type
    // "inter milan 3-2 liverpool" and we only match on team names
    const stripped = searchInput.replace(/\d+\s*[-:]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim()

    // Determine status filter based on submission type
    let statusFilter: string[]
    if (session.submission_type === 'fix') {
      statusFilter = ['confirmed', 'confirmed_pending', 'awaiting_confirmation']
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
      await sendTextMessage(from, `Sorry, I could not find those teams. Please type both full team names, e.g. "Paris Saint-Germain vs Arsenal".`, phoneNumberId)
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
      await sendTextMessage(from, `Sorry, I could not find those teams. Please type both full team names, e.g. "Paris Saint-Germain vs Arsenal".`, phoneNumberId)
      return
    }

    // Search all fixtures for this exact team pair. Non-admin players are limited
    // to games due today or within the last 7 days (submission window); admins may
    // submit fixtures on any date. If the pair has fixtures in multiple
    // tournaments/dates, the numbered list below lets the submitter pick the
    // correct one.
    const isAdmin = isAdminPhone(from)
    const { start: windowStart, end: windowEnd } = getSubmissionWindow()
    let query = supabase
      .from('fixtures')
      .select('id, home_team_id, away_team_id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
      .in('status', statusFilter)
      .or(`and(home_team_id.eq.${id1},away_team_id.eq.${id2}),and(home_team_id.eq.${id2},away_team_id.eq.${id1})`)
    if (!isAdmin) {
      query = query.gte('scheduled_date', windowStart).lte('scheduled_date', windowEnd)
    }
    const { data: fixtures } = await query
      .order('scheduled_date', { ascending: false })
      .order('matchday')

    const matchedFixtures = sortFixturesForDisplay((fixtures as any[]) || [])

    // If the user chose "first-time submission" and no scheduled fixture matches
    // within the window, the match may already be submitted/confirmed (or exist
    // outside the window). Surface the existing result or a clear block message
    // instead of a confusing "no fixture found".
    if (matchedFixtures.length === 0 && session.submission_type === 'new') {
      let alreadyQuery = supabase
        .from('fixtures')
        .select('id, home_team_id, away_team_id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score, match_stats:match_stats(*))')
        .in('status', ['confirmed', 'confirmed_pending', 'awaiting_confirmation', 'completed', 'abandoned'])
        .or(`and(home_team_id.eq.${id1},away_team_id.eq.${id2}),and(home_team_id.eq.${id2},away_team_id.eq.${id1})`)
      if (!isAdmin) {
        alreadyQuery = alreadyQuery.gte('scheduled_date', windowStart).lte('scheduled_date', windowEnd)
      }
      const { data: alreadyFixtures } = await alreadyQuery
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
        await sendTextMessage(from, `This match has already been submitted. Here are the results and stats:\n\n${hName} ${result?.home_score ?? '?'}-${result?.away_score ?? '?'} ${aName}${dateLine}${statsBlock ? '\n\n' + statsBlock : ''}\n\nWould you like to edit it? Reply YES or NO.${FLOW_HINT}`, phoneNumberId)
        return
      }
    }

    if (matchedFixtures.length === 0) {
      // For non-admins, the window-gated search found nothing. Check whether the
      // pair exists outside the window so we can show a clear "not released yet" /
      // "older than 7 days" message instead of "no match found".
      if (!isAdmin) {
        const { data: anyFixtures } = await supabase
          .from('fixtures')
          .select('id, scheduled_date')
          .in('status', ['scheduled', 'confirmed', 'confirmed_pending', 'awaiting_confirmation', 'completed', 'abandoned'])
          .or(`and(home_team_id.eq.${id1},away_team_id.eq.${id2}),and(home_team_id.eq.${id2},away_team_id.eq.${id1})`)
          .order('scheduled_date', { ascending: false })
          .order('matchday')
        const outOfWindow = ((anyFixtures as any[]) || []).find(
          (fx) => isInSubmissionWindow(fixtureDateKey(fx)) === false
        )
        if (outOfWindow) {
          const reason = submissionBlockReason(outOfWindow)
          if (reason) {
            await clearSession(from)
            await sendTextMessage(from, reason, phoneNumberId)
            return
          }
        }
      }
      await sendTextMessage(from, `No match found for that. Please type both full team names, e.g. "Arsenal vs Everton", or type CANCEL to stop.`, phoneNumberId)
      return
    }

    if (matchedFixtures.length === 1) {
      const f = matchedFixtures[0]
      const hName = fixtureTeamName(f, 'home')
      const aName = fixtureTeamName(f, 'away')
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      const isAlreadyConfirmed = isFixtureConfirmed(f)

      // Non-admins cannot submit out-of-window results — block with a clear message.
      if (!isAdmin) {
        const reason = submissionBlockReason(f)
        if (reason) {
          await clearSession(from)
          await sendTextMessage(from, reason, phoneNumberId)
          return
        }
      }

      await upsertSession({
        phone_number: from,
        matched_fixture_id: f.id,
        home_team: hName, away_team: aName,
        state: isAlreadyConfirmed ? 'awaiting_override_confirm' : 'idle',
        displayed_fixtures: null,
      })

      const resultLine = result && (f.status === 'confirmed' || f.status === 'confirmed_pending' || f.status === 'awaiting_confirmation')
        ? ` (already submitted: ${result.home_score}-${result.away_score})`
        : ''
      const dateLine = formatFixtureWhen(f) ? ` - ${formatFixtureWhen(f)}` : ''
      const tournamentLine = fixtureTournamentName(f) ? ` - ${fixtureTournamentName(f)}` : ''
      const overrideWarning = isAlreadyConfirmed ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
      const statsBlock = formatStatsBlock(session.match_stats)
      await sendTextMessage(from, `Found: ${hName} vs ${aName}${dateLine}${tournamentLine}${resultLine}\n\nConfirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel`, phoneNumberId)
      return
    }

    // Multiple matches — show numbered list
    await upsertSession({
      phone_number: from,
      state: 'awaiting_fixture_from_past',
      displayed_fixtures: matchedFixtures.map((f: any) => f.id),
    })

    await sendTextMessage(from, `Found ${matchedFixtures.length} matches:\n\n${formatFixtureListWithHeadings(matchedFixtures)}\n\nReply with the number of your match.${MATCH_LIST_HINT}`, phoneNumberId)
    return
  }

  // ─── Already-submitted match (user chose "first time" but fixture is confirmed) ─
  if (session?.state === 'awaiting_already_submitted') {
    const lower = normalizeText(text)
    if (isYes(lower) || includesWord(lower, 'edit')) {
      await clearSession(from)
      await sendTextMessage(from, "OK. Send a new screenshot, and choose option 2 (change a score that was already submitted).", phoneNumberId)
    } else if (isNo(lower)) {
      await clearSession(from)
      await sendTextMessage(from, "If you need to submit a new match, send a new screenshot and let me know.", phoneNumberId)
    } else if (isCancel(text)) {
      await clearSession(from)
      await sendTextMessage(from, "OK. Send a new screenshot when you're ready.", phoneNumberId)
    } else {
      await sendTextMessage(from, `Would you like to edit the submitted result? Reply YES or NO.${FLOW_HINT}`, phoneNumberId)
    }
    return
  }

  // No active flow: this is initial contact. Show the welcome menu so the user
  // can pick what they want to do. Every mid-flow state is handled earlier, and
  // score-based flows always have scores set, so this never re-triggers while a
  // flow is waiting for input.
  const isBackdoorState = session?.state?.startsWith('awaiting_backdoor') === true
  if (!session || (!isBackdoorState && session.home_score === null && session.away_score === null)) {
    await handleWelcomeMenu(from, text, phoneNumberId)
    return
  }

  const supabase = await createAdminClient()

  // Forfeit question: did the losing team forfeit?
  if (session?.state === 'awaiting_forfeit') {
    const lower = normalizeText(text)
    if (isYes(lower) || lower.includes('forfeit')) {
      await handleForfeitYes(from, session, supabase, phoneNumberId)
      return
    }
    if (isNo(lower)) {
      await upsertSession({ phone_number: from, state: 'idle' })
      console.log('[webhook] user declined forfeit, writing to DB')
      const { data: fixCheck } = await supabase
        .from('fixtures')
        .select('status')
        .eq('id', session.matched_fixture_id)
        .single()
      if (fixCheck && (fixCheck.status === 'confirmed' || fixCheck.status === 'confirmed_pending' || fixCheck.status === 'awaiting_confirmation')) {
        await resetAndResubmit(from, session, supabase, phoneNumberId)
      } else {
        await writeResultToDb(from, session, supabase, phoneNumberId)
      }
      return
    }
    await sendTextMessage(from, `Did the losing team forfeit before the game finished? Reply YES or NO.${FLOW_HINT}`, phoneNumberId)
    return
  }

  // ─── Edit score: user types new score ──────────────────────────────────
  // Handled BEFORE the direct-bypass block so a raw score like "2-3" isn't
  // intercepted by the numbered-action menu (extractNumber("2-3") === 2 → would
  // re-trigger the edit-score prompt forever).
  if (session?.state === 'awaiting_edit_score') {
    const match = text.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/)
    if (!match) {
      await sendTextMessage(from, `Please type the score as: 3-2${FLOW_HINT}`, phoneNumberId)
      return
    }
    const newHomeScore = parseInt(match[1], 10)
    const newAwayScore = parseInt(match[2], 10)

    const { data: fixCheck } = await supabase
      .from('fixtures')
      .select('status')
      .eq('id', session.matched_fixture_id)
      .single()
    const wasOverride = fixCheck && (fixCheck.status === 'confirmed' || fixCheck.status === 'confirmed_pending' || fixCheck.status === 'awaiting_confirmation')

    await upsertSession({
      phone_number: from,
      home_score: newHomeScore,
      away_score: newAwayScore,
      state: wasOverride ? 'awaiting_override_confirm' : 'idle',
    })

    const statsBlock = formatStatsBlock(session.match_stats)
    const overrideWarning = wasOverride ? '\n\n⚠️ This result is already submitted. Submitting again will override the existing stats.' : ''
    await sendTextMessage(from, `Score updated.\n\nConfirm result: ${session.home_team} ${newHomeScore}-${newAwayScore} ${session.away_team}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel`, phoneNumberId)
    return
  }

  // CANCEL — always works regardless of flow state
  if (isCancel(text)) {
    console.log('[webhook] user CANCEL')
    await clearSession(from)
    await sendTextMessage(from, "OK. Send a new screenshot when you're ready.", phoneNumberId)
    return
  }

  // Direct bypass: if session has matched_fixture_id and user says anything affirmative, write to DB
  if (session.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
    const lower = normalizeText(text)
    const num = extractNumber(text)

    // Numbered action menu: 1 = submit, 2 = edit score, 3 = swap, 4 = cancel.
    // A fixture is already matched at this point, so a number maps to an action
    // (not a fixture pick — the pick happens before matching).
    const actionByNumber = num === 1 ? 'submit' : num === 2 ? 'edit_score' : num === 3 ? 'swap' : num === 4 ? 'cancel' : null

    const affirmative = isYes(text) || lower.includes('yes') || lower.includes('confirm') || lower.includes('submit') || actionByNumber === 'submit'
    if (affirmative) {
      // Override flow: ask about forfeit first, then reset + re-submit
      if (session.state === 'awaiting_override_confirm') {
        await upsertSession({ phone_number: from, state: 'awaiting_forfeit' })
        await sendTextMessage(from, `Did the losing team forfeit before the game finished? Reply yes or no.${FLOW_HINT}`, phoneNumberId)
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
        if (fixCheck2 && (fixCheck2.status === 'confirmed' || fixCheck2.status === 'confirmed_pending' || fixCheck2.status === 'awaiting_confirmation')) {
          await resetAndResubmit(from, session, supabase, phoneNumberId)
        } else {
          await writeResultToDb(from, session, supabase, phoneNumberId)
        }
        return
      }
      // First confirmation: ask about forfeit before writing to DB
      if (!session.displayed_fixtures || session.displayed_fixtures.length === 0) {
        await upsertSession({ phone_number: from, state: 'awaiting_forfeit' })
        await sendTextMessage(from, `Did the losing team forfeit before the game finished? Reply yes or no.${FLOW_HINT}`, phoneNumberId)
        return
      }
      console.log('[webhook] direct bypass: user affirmed, writing to DB')
      await writeResultToDb(from, session, supabase, phoneNumberId)
      return
    }
    // Cancel via the numbered menu
    if (actionByNumber === 'cancel') {
      console.log('[webhook] user CANCEL (menu)')
      await clearSession(from)
      await sendTextMessage(from, "OK. Send a new screenshot when you're ready.", phoneNumberId)
      return
    }
    // SWAP — flip scores and stats to match DB orientation (team names stay from DB)
    if (actionByNumber === 'swap' || includesWord(text, 'swap')) {
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
      await sendTextMessage(from, `Scores swapped.\n\nConfirm result: ${session.home_team} ${newHomeScore}-${newAwayScore} ${session.away_team}?${statsBlock ? '\n\n' + statsBlock : ''}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel`, phoneNumberId)
      return
    }
    // EDIT SCORE — override the score for aggregate/replay situations
    if (actionByNumber === 'edit_score' || includesWord(text, 'edit score') || includesWord(text, 'score')) {
      await upsertSession({ phone_number: from, state: 'awaiting_edit_score' })
      await sendTextMessage(from, `What is the correct aggregate score? Type it as: 3-2${FLOW_HINT}`, phoneNumberId)
      return
    }
  }

  // "check other date" — restart fixture matching with a different date
  if (includesWord(text, 'check other date') || includesWord(text, 'different date')) {
    if (!session || session.home_score === null) {
      await sendTextMessage(from, "Send a screenshot first, then I can help you check a different date.", phoneNumberId)
      return
    }
    await upsertSession({ phone_number: from, state: 'awaiting_date', matched_fixture_id: null, displayed_fixtures: null })
    await sendTextMessage(from, `What date? Type it like "12 Jul", "July 12", or "2026-07-12".${FLOW_HINT}`, phoneNumberId)
    return
  }

  // Date input: user types a date while in awaiting_date state
  if (session.state === 'awaiting_date') {
    const parsed = parseUserDate(text)
    if (!parsed) {
      await sendTextMessage(from, `Sorry, I didn't catch that. Try something like "12 Jul", "July 12", or "2026-07-12".${FLOW_HINT}`, phoneNumberId)
      return
    }
    const { dateKey } = parsed

    // Non-admins can only submit games due today or within the last 7 days.
    if (!isAdminPhone(from) && !isInSubmissionWindow(dateKey)) {
      const fake = { scheduled_date: dateKey }
      const reason = submissionBlockReason(fake)
      if (reason) {
        await clearSession(from)
        await sendTextMessage(from, reason, phoneNumberId)
        return
      }
    }

    const { data: dateFixtures } = await supabase
      .from('fixtures')
      .select('id, status, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), tournament:tournaments(name), results!results_fixture_id_fkey(home_score, away_score)')
      .eq('scheduled_date', dateKey)
      .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed', 'confirmed_pending'])
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
    await sendTextMessage(from, `Fixtures for ${dateLabel}:\n\n${lines.join('\n')}\n\nReply with the number of your match.${MATCH_LIST_HINT}\n\nYour fixture isn't here? Type "check other date".`, phoneNumberId)
    return
  }

  // Past-date fixture selection: user picks a number from a past date's fixtures
  if (session.state === 'awaiting_fixture_from_past') {
    if (isCancel(text)) {
      await clearSession(from)
      await sendTextMessage(from, "OK. Send a new screenshot when you're ready.", phoneNumberId)
      return
    }
    if (await handleStartAgain(from, text, phoneNumberId)) return
    const num = extractNumber(text)
    if (num !== null && num > 0 && session.displayed_fixtures && num <= session.displayed_fixtures.length) {
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

        // Non-admins cannot submit out-of-window results — block with a clear message.
        if (!isAdminPhone(from)) {
          const reason = submissionBlockReason(cf)
          if (reason) {
            await clearSession(from)
            await sendTextMessage(from, reason, phoneNumberId)
            return
          }
        }

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

        await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel`, phoneNumberId)
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
          .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed', 'confirmed_pending'])
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

          if (!isAdminPhone(from)) {
            const reason = submissionBlockReason(cf)
            if (reason) {
              await clearSession(from)
              await sendTextMessage(from, reason, phoneNumberId)
              return
            }
          }

          await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel${hint}`, phoneNumberId)
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
            .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed', 'confirmed_pending'])
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

            if (!isAdminPhone(from)) {
              const reason = submissionBlockReason(chosen)
              if (reason) {
                await clearSession(from)
                await sendTextMessage(from, reason, phoneNumberId)
                return
              }
            }

            await sendTextMessage(from, `Confirm result: ${hName} ${session.home_score}-${session.away_score} ${aName}?${statsBlock ? '\n\n' + statsBlock : ''}${overrideWarning}\n\n1. Submit result\n2. Edit score\n3. Swap the stats\n4. Cancel${hint}`, phoneNumberId)
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
      if (!session) { await handleWelcomeMenu(from, text, phoneNumberId); return }
      if (session.matched_fixture_id && session.home_score !== null && session.away_score !== null) {
        if (session.state === 'awaiting_override_confirm') {
          await resetAndResubmit(from, session, supabase, phoneNumberId); return
        }
        await writeResultToDb(from, session, supabase, phoneNumberId); return
      }
      await sendTextMessage(from, resultFlowReprompt(session), phoneNumberId)
      return
    }
    case 'correct': {
      if (!session || !intent.corrections) {
        await sendTextMessage(from, session ? resultFlowReprompt(session) : WELCOME_MENU, phoneNumberId)
        return
      }
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
    default: { await sendTextMessage(from, session ? resultFlowReprompt(session) : WELCOME_MENU, phoneNumberId); return }
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
  await sendTextMessage(from, "OK, checking your screenshot... \uD83D\uDC40", phoneNumberId)

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

  if (invalidReason) { await sendTextMessage(from, "Sorry, I could not read the screenshot. Please send it again.", phoneNumberId); return }
  if (homeScore === null || awayScore === null) { await sendTextMessage(from, "Sorry, I could not read the screenshot. Please send it again.", phoneNumberId); return }

  await upsertSession({
    phone_number: from,
    home_team: homeTeam, away_team: awayTeam, home_score: homeScore, away_score: awayScore,
    match_stats: matchStats, matched_fixture_id: null, screenshot_media_id: imageId,
    state: 'awaiting_submission_type',
    submission_type: null,
    submission_menu_step: 'menu'
  })

  await sendTextMessage(from, `Score extracted: ${homeTeam || '?'} ${homeScore}-${awayScore} ${awayTeam || '?'}\n\nWhat do you want to do?\n1. Submit this match's score for the first time\n2. Change a score that was already submitted\n\nReply 1 or 2. Type CANCEL to stop.`, phoneNumberId)
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

  // Final safety gate: non-admins may only submit results for games due today or
  // within the last 7 days. This prevents any bypass through the direct-bypass or
  // LLM-confirm paths.
  if (!isAdminPhone(from)) {
    const { data: gateFix } = await supabase
      .from('fixtures')
      .select('id, scheduled_date')
      .eq('id', session.matched_fixture_id)
      .single()
    if (gateFix) {
      const reason = submissionBlockReason(gateFix)
      if (reason) {
        await clearSession(from)
        await sendTextMessage(from, reason, phoneNumberId)
        return
      }
    }
  }

  const isForfeitConfirm = session.state === 'awaiting_forfeit_confirm'
  const adminUserId = await getAdminUserId(supabase)
  console.log('[webhook] admin user celemqhele id:', adminUserId || 'NOT FOUND')

  // Look up fixture for team IDs, managers and scheduled date
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, round_type, tournament_id, scheduled_date, home_team:teams!fixtures_home_team_id_fkey(manager_id, manager:profiles!teams_manager_id_fkey(phone)), away_team:teams!fixtures_away_team_id_fkey(manager_id, manager:profiles!teams_manager_id_fkey(phone))')
    .eq('id', session.matched_fixture_id)
    .single()

  const fixtureHome = fixture ? (Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team) : null
  const fixtureAway = fixture ? (Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team) : null

  // A fixture due in the FUTURE is captured as 'confirmed_pending' (deferred
  // standings/knockout until its due date) rather than immediately confirmed.
  const todayKey = new Date().toISOString().slice(0, 10)
  const isPending = !!(fixture?.scheduled_date && fixtureDateKey(fixture) > todayKey)

  const hName = fixture ? fixtureTeamName(fixture, 'home') : 'Home'
  const aName = fixture ? fixtureTeamName(fixture, 'away') : 'Away'

  let homeScore = session.home_score
  let awayScore = session.away_score
  let forfeitBalanceNote = ''

  // Determine which manager is texting (recipient) for personalized forfeit messages
  const recipientManagerId = [fixtureHome, fixtureAway].find(m =>
    m?.manager_id && phoneNumbersMatch(
      (Array.isArray(m.manager) ? m.manager[0]?.phone : (m as any)?.manager?.phone) ?? null,
      from
    )
  )?.manager_id ?? null

  // Forfeit balance aggregate: check if either team's manager has active forfeit balances.
  // The forfeit score always carries over to the next meeting between the same two teams (per the rules),
  // regardless of who is currently winning. Skip when this is a forfeit confirm — handleForfeitYes already applied the +3.
  if (!isForfeitConfirm && fixture?.home_team_id && fixture?.away_team_id) {
    const managerIds = [fixtureHome?.manager_id, fixtureAway?.manager_id].filter(Boolean)
    if (managerIds.length > 0) {
      const { data: balances } = await supabase
        .from('forfeit_balances')
        .select('id, forfeiting_score, opponent_score, forfeiting_manager_id, opponent_team_id, forfeiting_manager:profiles!forfeit_balances_forfeiting_manager_id_fkey(username), opponent_team:teams!forfeit_balances_opponent_team_id_fkey(name)')
        .in('forfeiting_manager_id', managerIds)
        .gt('remaining', 0)

      if (balances && balances.length > 0) {
        // Pre-fetch team names for both fixture managers
        const teamNames: Record<string, string> = {}
        const { data: teamRows } = await supabase
          .from('teams')
          .select('name, manager_id')
          .in('manager_id', managerIds)
        for (const t of teamRows ?? []) {
          if (t.manager_id) teamNames[t.manager_id] = t.name
        }

        const forfeitNoteParts: string[] = []
        for (const bal of balances) {
          const forfeitingIsHome = bal.forfeiting_manager_id === fixtureHome?.manager_id
          const forfeitingScore = bal.forfeiting_score ?? 0
          const opponentScore = bal.opponent_score ?? 0
          if (forfeitingIsHome) {
            homeScore += forfeitingScore
            awayScore += opponentScore
          } else {
            awayScore += forfeitingScore
            homeScore += opponentScore
          }
          await supabase.from('forfeit_balances').update({ remaining: 0 }).eq('id', bal.id)

          const forfeitTeamName = teamNames[bal.forfeiting_manager_id] || 'Team'
          const oppName = (Array.isArray(bal.opponent_team) ? bal.opponent_team[0]?.name : bal.opponent_team?.name) || 'Opponent'
          if (bal.forfeiting_manager_id === recipientManagerId) {
            forfeitNoteParts.push(`You forfeited your last game against ${oppName}`)
          } else {
            forfeitNoteParts.push(`Your opponent (${forfeitTeamName}) forfeited their last game against ${oppName}`)
          }
        }
        const reasonText = forfeitNoteParts.join('; ')
        forfeitBalanceNote = `\n\n${reasonText}.\nScore: ${hName} ${homeScore}-${awayScore} ${aName}.`
        console.log('[webhook] forfeit balance applied:', reasonText, 'score:', homeScore, '-', awayScore)
      }
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

      const forfManagerId = homeForfeit ? fixtureHome?.manager_id : fixtureAway?.manager_id
      const oppTeamId = homeForfeit ? fixture.away_team_id : fixture.home_team_id
      if (forfManagerId) {
        await supabase.from('forfeit_balances').insert({
          fixture_id: session.matched_fixture_id,
          forfeiting_manager_id: forfManagerId,
          opponent_team_id: oppTeamId,
          opponent_score: homeForfeit ? origAwayScore : origHomeScore,
          forfeiting_score: homeForfeit ? origHomeScore : origAwayScore,
          half_time_note: `Forfeit: ${homeScore}-${awayScore} (adjusted from ${origHomeScore}-${origAwayScore})`,
        })
      }

      // Recalculate standings since trigger double-counts on UPDATE. Skipped for
      // future-dated (confirmed_pending) forfeits — standings apply at the flip.
      if (!isPending) {
        const { data: fixData } = await supabase.from('fixtures').select('tournament_id').eq('id', session.matched_fixture_id).single()
        if (fixData?.tournament_id) {
          try { await recalculateStandings(fixData.tournament_id) } catch (e) { console.error('[webhook] standings recalc after forfeit failed:', e) }
        }
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

  // Verify fixture status after the on_result_insert trigger (migration 003).
  // For on-time / backdated games the trigger sets status = 'confirmed'; if that
  // didn't happen, force it here. For FUTURE-dated (pending) games the trigger
  // sets status = 'confirmed_pending' — we leave it so standings/knockout stay
  // deferred until the flip to 'confirmed' on the fixture date.
  const { data: verifyFixture } = await supabase
    .from('fixtures')
    .select('status')
    .eq('id', session.matched_fixture_id)
    .single()

  if (!isPending && verifyFixture?.status !== 'confirmed') {
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
  } else if (isPending && verifyFixture?.status !== 'confirmed_pending') {
    // Safety: ensure a future-dated game is held as pending.
    await supabase
      .from('fixtures')
      .update({ status: 'confirmed_pending' })
      .eq('id', session.matched_fixture_id)
  }

  // Void any pending backdoor submissions for this fixture now that the real
  // result is recorded (on-time / backdated games only). Mirrors
  // finalise-result/route.ts — the WhatsApp result path previously left them
  // stale as 'pending', which could then be wrongly approved.
  if (!isPending) {
    await supabase
      .from('backdoor_submissions')
      .update({ status: 'void_game_played' })
      .eq('fixture_id', session.matched_fixture_id)
      .eq('status', 'pending')
  }

  // Knockout progression only happens once the game is confirmed — a
  // future-dated (pending) result must NOT advance the winner until its due date.
  if (!isPending && ['r16', 'qf', 'sf', 'final'].includes(fixture?.round_type ?? '')) {
    try {
      await advanceWinner(
        supabase,
        fixture.tournament_id,
        session.matched_fixture_id,
        homeScore,
        awayScore,
        fixture.home_team_id ?? null,
        fixture.away_team_id ?? null
      )
    } catch (e) {
      console.error('[webhook] knockout progression failed:', e)
    }
  }

  console.log('[webhook] result written:', { fixture_id: session.matched_fixture_id, home_score: homeScore, away_score: awayScore, submitted_by: adminUserId, isPending })

  let submittedMessage: string
  if (isPending) {
    const releaseLabel = String(fixture?.scheduled_date ?? '').slice(0, 10)
    submittedMessage = `Result submitted ✓ (score: ${hName} ${homeScore}-${awayScore} ${aName}).\n\nThis result has been saved but won't be applied to the standings yet — the match fixture is not released until ${releaseLabel}. The result will be confirmed automatically at 00:00 on ${releaseLabel}.`
  } else {
    submittedMessage = `Result submitted!${forfeitBalanceNote}\n\nCheck your standings here: https://efa-fxyk.vercel.app/standings`
  }

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
          title: isPending ? 'Result Received (Pending Release)' : 'Result Confirmed',
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

  // Final safety gate: non-admins may only submit results for games due today or
  // within the last 7 days.
  if (!isAdminPhone(from)) {
    const { data: RgateFix } = await supabase
      .from('fixtures')
      .select('id, scheduled_date')
      .eq('id', session.matched_fixture_id)
      .single()
    if (RgateFix) {
      const reason = submissionBlockReason(RgateFix)
      if (reason) {
        await clearSession(from)
        await sendTextMessage(from, reason, phoneNumberId)
        return
      }
    }
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
