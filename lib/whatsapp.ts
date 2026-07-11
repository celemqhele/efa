const GRAPH_API = 'https://graph.facebook.com/v22.0'
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

import { createHmac } from 'crypto'

export function hashPin(pin: string): string {
  return createHmac('sha256', process.env.PIN_SALT || 'efa-default-salt')
    .update(pin)
    .digest('hex')
}

export async function verifyPin(
  phoneNumber: string,
  teamId: string,
  pin: string,
  supabase: any,
): Promise<'ok' | 'wrong' | 'locked' | 'not_found'> {
  const { data } = await supabase
    .from('manager_pins')
    .select('pin_hash, failed_attempts, locked_until')
    .eq('phone_number', phoneNumber)
    .eq('team_id', teamId)
    .maybeSingle()

  if (!data) return 'not_found'

  if (data.locked_until) {
    const lock = new Date(data.locked_until)
    if (lock > new Date()) return 'locked'
    // Lock expired — reset
    await supabase
      .from('manager_pins')
      .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
      .eq('phone_number', phoneNumber)
      .eq('team_id', teamId)
  }

  const valid = hashPin(pin) === data.pin_hash

  if (valid) {
    if (data.failed_attempts > 0) {
      await supabase
        .from('manager_pins')
        .update({ failed_attempts: 0, updated_at: new Date().toISOString() })
        .eq('phone_number', phoneNumber)
        .eq('team_id', teamId)
    }
    return 'ok'
  }

  const newAttempts = (data.failed_attempts || 0) + 1
  const updates: any = { failed_attempts: newAttempts, updated_at: new Date().toISOString() }
  if (newAttempts >= 5) {
    updates.locked_until = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  }
  await supabase
    .from('manager_pins')
    .update(updates)
    .eq('phone_number', phoneNumber)
    .eq('team_id', teamId)

  return newAttempts >= 5 ? 'locked' : 'wrong'
}

export async function storePin(
  phoneNumber: string,
  teamId: string,
  pin: string,
  supabase: any,
): Promise<boolean> {
  const { error } = await supabase
    .from('manager_pins')
    .upsert({
      phone_number: phoneNumber,
      team_id: teamId,
      pin_hash: hashPin(pin),
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
  if (error) console.error('[whatsapp] storePin error:', error.message, error.details)
  return !error
}

type OcrCleanedResult = {
  valid?: boolean
  reason?: string
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  matchStats: Record<string, { home: number; away: number }> | null
}

function parseCleanedJson(text: string): OcrCleanedResult | null {
  try {
    const parsed = JSON.parse(text)

    let matchStats: Record<string, { home: number; away: number }> | null = null
    if (parsed.stats && typeof parsed.stats === 'object') {
      matchStats = {}
      for (const [key, val] of Object.entries(parsed.stats)) {
        if (Array.isArray(val) && val.length >= 2 && typeof val[0] === 'number' && typeof val[1] === 'number') {
          matchStats[key] = { home: val[0], away: val[1] }
        }
      }
      if (Object.keys(matchStats).length === 0) matchStats = null
    }

    return {
      valid: parsed.valid,
      reason: parsed.reason || undefined,
      homeTeam: parsed.homeTeam ?? null,
      awayTeam: parsed.awayTeam ?? null,
      homeScore: typeof parsed.homeScore === 'number' ? parsed.homeScore : null,
      awayScore: typeof parsed.awayScore === 'number' ? parsed.awayScore : null,
      matchStats,
    }
  } catch {
    console.error('Failed to parse JSON:', text)
    return null
  }
}

function authHeader() {
  return `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
}

export async function getMediaUrl(mediaId: string): Promise<string> {
  const res = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Media URL fetch failed (${res.status}): ${err}`)
  }
  const json = await res.json()
  return json.url
}

export async function fetchImageBytes(mediaUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) {
    throw new Error(`Image fetch failed (${res.status})`)
  }
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, mimeType }
}

export async function sendTextMessage(to: string, body: string, phoneNumberId: string): Promise<void> {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('WhatsApp send failed:', err)
  }
}

export async function cleanOcrText(ocrText: string): Promise<OcrCleanedResult | null> {
  const prompt = `You are reading OCR output from a screenshot of the mobile game eFootball. The OCR text may contain garbled characters, split lines, or misread text.

Determine if this is a FINISHED match result or something else (live match, menu, etc).

A screenshot is a valid finished result ONLY if it shows one of:
- A "Full Time" banner with a scoreline
- A "You Won" or "You Lost" popup saying the opponent conceded/forfeited

If it's a live match (has a running clock like "28:35"), a menu, or anything else that is NOT a finished result, respond with:
{ "valid": false, "reason": "short description of what this screenshot actually shows" }

If it IS a valid finished result, extract:
{
  "valid": true,
  "homeTeam": "string, team name if visible, otherwise the player gamertag",
  "awayTeam": "string, same rule",
  "homeScore": number,
  "awayScore": number,
  "stats": {
    "possession": [home, away] or null,
    "shots": [home, away] or null,
    "shotsOnTarget": [home, away] or null,
    "fouls": [home, away] or null,
    "offsides": [home, away] or null,
    "cornerKicks": [home, away] or null,
    "freeKicks": [home, away] or null,
    "passes": [home, away] or null,
    "successfulPasses": [home, away] or null,
    "crosses": [home, away] or null,
    "interceptions": [home, away] or null,
    "tackles": [home, away] or null,
    "saves": [home, away] or null
  } or null if no stat table is visible
}

Rules:
- If a stat table is partially visible (cut off), only include the stats you can actually read; set the rest to null within the stats object.
- Never guess or estimate a number you cannot clearly read. Use null instead.
- Respond with ONLY the JSON object, no other text.

Here is the raw OCR text:
---
${ocrText}
---`

  const res = await fetch(`${GEMINI_API}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini text API failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')

  return parseCleanedJson(text)
}

export async function cleanOcrWithGroq(ocrText: string): Promise<OcrCleanedResult | null> {
  const prompt = `You are reading OCR output from a screenshot of the mobile game eFootball. The OCR text may contain garbled characters, split lines, or misread text.

Determine if this is a FINISHED match result or something else (live match, menu, etc).

A screenshot is a valid finished result ONLY if it shows one of:
- A "Full Time" banner with a scoreline
- A "You Won" or "You Lost" popup saying the opponent conceded/forfeited

If it's a live match (has a running clock like "28:35"), a menu, or anything else that is NOT a finished result, respond with:
{ "valid": false, "reason": "short description of what this screenshot actually shows" }

If it IS a valid finished result, extract:
{
  "valid": true,
  "homeTeam": "string, team name if visible, otherwise the player gamertag",
  "awayTeam": "string, same rule",
  "homeScore": number,
  "awayScore": number,
  "stats": {
    "possession": [home, away] or null,
    "shots": [home, away] or null,
    "shotsOnTarget": [home, away] or null,
    "fouls": [home, away] or null,
    "offsides": [home, away] or null,
    "cornerKicks": [home, away] or null,
    "freeKicks": [home, away] or null,
    "passes": [home, away] or null,
    "successfulPasses": [home, away] or null,
    "crosses": [home, away] or null,
    "interceptions": [home, away] or null,
    "tackles": [home, away] or null,
    "saves": [home, away] or null
  } or null if no stat table is visible
}

Rules:
- If a stat table is partially visible (cut off), only include the stats you can actually read; set the rest to null within the stats object.
- Never guess or estimate a number you cannot clearly read. Use null instead.
- Respond with ONLY the JSON object, no other text.

Here is the raw OCR text:
---
${ocrText}
---`

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty Groq response')

  return parseCleanedJson(content)
}

export async function analyzeScreenshot(imageBuffer: Buffer, mimeType: string): Promise<OcrCleanedResult | null> {
  const base64 = imageBuffer.toString('base64')

  const prompt = `You are reading a screenshot from the mobile game eFootball. Determine if this is a FINISHED match result or something else (live match, menu, etc).

A screenshot is a valid finished result ONLY if it shows one of:
- A "Full Time" banner with a scoreline
- A "You Won" or "You Lost" popup saying the opponent conceded/forfeited

If it's a live match (has a running clock like "28:35"), a menu, or anything else that is NOT a finished result, respond with:
{ "valid": false, "reason": "short description of what this screenshot actually shows" }

If it IS a valid finished result, extract:
{
  "valid": true,
  "homeTeam": "string, team name if visible on a crest/label, otherwise the player gamertag",
  "awayTeam": "string, same rule",
  "homeScore": number,
  "awayScore": number,
  "stats": {
    "possession": [home, away] or null if not visible,
    "shots": [home, away] or null,
    "shotsOnTarget": [home, away] or null,
    "fouls": [home, away] or null,
    "offsides": [home, away] or null,
    "cornerKicks": [home, away] or null,
    "freeKicks": [home, away] or null,
    "passes": [home, away] or null,
    "successfulPasses": [home, away] or null,
    "crosses": [home, away] or null,
    "interceptions": [home, away] or null,
    "tackles": [home, away] or null,
    "saves": [home, away] or null
  } or null if no stat table is visible (e.g. a "conceded" popup with no stats shown)
}

Rules:
- If a stat table is partially visible (cut off), only include the stats you can actually read; set the rest to null within the stats object.
- Never guess or estimate a number you cannot clearly read. Use null instead.
- Team crests/badges may not match team names exactly (e.g. a generic club badge); prefer the text label next to the crest if present.
- Respond with ONLY the JSON object, no other text.`

  const res = await fetch(`${GEMINI_API}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')

  return parseCleanedJson(text)
}

export interface ConversationIntent {
  reply: string
  intent: 'confirm' | 'correct' | 'select_fixture' | 'query_fixtures' | 'query_standings' | 'query_results' | 'cancel' | 'help' | 'unknown'
  corrections?: { homeScore: number | null; awayScore: number | null; homeTeam: string | null; awayTeam: string | null } | null
  fixtureChoice?: number | null
  queryRequest?: 'fixtures' | 'standings' | 'results' | null
}

export async function conversationalReply(
  systemPrompt: string,
  context: object,
): Promise<ConversationIntent> {
  const content = JSON.stringify(context)

  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const text = json.choices?.[0]?.message?.content
      if (text) return parseIntent(text)
    }
  } catch (groqErr) {
    console.error('[conversationalReply] Groq failed:', groqErr)
  }

  // Gemini fallback
  try {
    const res = await fetch(`${GEMINI_API}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nUser context: ${content}` },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return parseIntent(text)
    }
  } catch (geminiErr) {
    console.error('[conversationalReply] Gemini fallback failed:', geminiErr)
  }

  return {
    reply: "Sorry bru, I'm having a brain freeze right now. Can you try again?",
    intent: 'unknown' as const,
  }
}

function parseIntent(text: string): ConversationIntent {
  try {
    const parsed = JSON.parse(text)
    return {
      reply: parsed.reply || "Ja, what's up?",
      intent: parsed.intent || 'unknown',
      corrections: parsed.corrections || null,
      fixtureChoice: typeof parsed.fixtureChoice === 'number' ? parsed.fixtureChoice : null,
      queryRequest: parsed.queryRequest || null,
    }
  } catch {
    console.error('[conversationalReply] failed to parse LLM output:', text)
    return {
      reply: text.slice(0, 500) || "Sorry, I didn't understand that. Can you try again?",
      intent: 'unknown' as const,
    }
  }
}
