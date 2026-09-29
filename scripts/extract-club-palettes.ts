/**
 * Colour-matched eFootball club suggestions for Season 4.
 *
 * No South African league exists in eFootball — Konami's official license list
 * (https://www.konami.com/efootball/en/page/license_efootball) has no SA entry —
 * so all 32 Season 4 clubs need a visually similar substitute crest to use in-game.
 *
 * Reads the crest PNGs already on disk under public/logos/<folder>/256x256/<slug>.png,
 * reduces each to a small set of dominant hue families, then scores every EFA crest
 * against every candidate eFootball crest in OKLab and ranks the closest.
 *
 * Scoring note: colour *area* is a bad proxy for how a crest reads. Brazil's crest
 * extracts as blue-dominant (31% blue vs 12% yellow / 11% green) purely because the
 * CBF shield fill dominates the artwork, which hides the yellow-and-green that
 * actually makes it look like Mamelodi Sundowns. So hues are binned into families
 * and weighted by sqrt(area) rather than area, which compresses a large accent fill
 * without erasing it, and matching is deliberately asymmetric — a candidate is
 * rewarded for *containing* the EFA club's signature colours.
 *
 * Usage:
 *   npx tsx scripts/extract-club-palettes.ts                     # full ranked table
 *   npx tsx scripts/extract-club-palettes.ts sundowns brazil     # inspect palettes
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import path from 'path'
import { loadEnvFile } from 'process'
import { Client } from 'pg'
import sharp from 'sharp'
import { slugToDisplayName, getLeagueDisplayName } from '../lib/logo-resolver'

try {
  loadEnvFile('.env.supabase')
} catch {
  // no .env.supabase - fall back to process env
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos')
const SIZE = '256x256'
const POOL_LEAGUES = [
  'english-premier-league-2025-2026.football-logos.cc',
  'spain-la-liga-2025-2026.football-logos.cc',
  'italy-serie-a-2025-2026.football-logos.cc',
  'fifa-world-cup-2026.football-logos.cc',
] as const

const ALPHA_MIN = 128
const MIN_SHARE = 0.03
const TOP_N = 4
const CHROMA_MIN = 0.03 // below this a pixel reads as grey/white/black, not a hue
const HUE_BINS = 12

type Colour = { hex: string; r: number; g: number; b: number; share: number; weight: number; family: string }
type Palette = { key: string; label: string; league: string; colours: Colour[] }

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function rgbToOklab(r: number, g: number, b: number) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  return { L, a, b: bb, C: Math.sqrt(a * a + bb * bb), h: (Math.atan2(bb, a) * 180) / Math.PI }
}

function toHex(r: number, g: number, b: number) {
  const hx = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase()
}

const HUE_NAMES = ['red', 'orange', 'yellow', 'lime', 'green', 'spring', 'cyan', 'azure', 'blue', 'violet', 'magenta', 'rose']

function familyName(L: number, C: number, h: number): string {
  if (C < CHROMA_MIN) return L < 0.3 ? 'black' : L > 0.78 ? 'white' : 'grey'
  const idx = (Math.round((((h % 360) + 360) % 360) / (360 / HUE_BINS))) % HUE_BINS
  const band = L < 0.4 ? 'dark ' : L > 0.75 ? 'light ' : ''
  return band + HUE_NAMES[idx]
}

function dist(a: Colour, b: Colour) {
  const la = rgbToOklab(a.r, a.g, a.b)
  const lb = rgbToOklab(b.r, b.g, b.b)
  const dL = la.L - lb.L
  const da = la.a - lb.a
  const db = la.b - lb.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

async function extractPalette(folder: string, slug: string): Promise<Colour[]> {
  const file = path.join(LOGO_DIR, folder, SIZE, `${slug}.png`)
  if (!existsSync(file)) throw new Error(`logo missing: ${folder}/${SIZE}/${slug}.png`)

  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  type Acc = { n: number; r: number; g: number; b: number }
  const bins = new Map<string, Acc>()
  let total = 0

  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < ALPHA_MIN) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lab = rgbToOklab(r, g, b)
    const fam = familyName(lab.L, lab.C, lab.h)
    const cur = bins.get(fam) ?? { n: 0, r: 0, g: 0, b: 0 }
    cur.n++
    cur.r += r
    cur.g += g
    cur.b += b
    bins.set(fam, cur)
    total++
  }
  if (!total) throw new Error(`no opaque pixels: ${slug}`)

  const ranked = [...bins.entries()]
    .map(([family, bk]) => {
      const r = Math.round(bk.r / bk.n)
      const g = Math.round(bk.g / bk.n)
      const b = Math.round(bk.b / bk.n)
      const share = bk.n / total
      return { hex: toHex(r, g, b), r, g, b, share, family, weight: Math.sqrt(share) }
    })
    .filter((c) => c.share >= MIN_SHARE)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, TOP_N)

  return ranked
}

/** presence-weighted mean distance from each colour in `from` to its nearest in `to` */
function directed(from: Colour[], to: Colour[]): number {
  if (!from.length || !to.length) return Infinity
  let acc = 0
  let wsum = 0
  for (const a of from) {
    let best = Infinity
    for (const b of to) best = Math.min(best, dist(a, b))
    acc += a.weight * best
    wsum += a.weight
  }
  return acc / wsum
}

/**
 * Asymmetric on purpose: a candidate is rewarded for containing the EFA club's
 * signature colours, and only lightly penalised for having extra ones. Symmetric
 * scoring made candidates with an extra large accent (Brazil's blue shield) look
 * like a worse match than candidates that are simply near-identical palettes.
 */
function scorePair(a: Palette, b: Palette): number {
  return 0.75 * directed(a.colours, b.colours) + 0.25 * directed(b.colours, a.colours)
}

/**
 * Candidate pool from the logos actually on disk, not from lib/efootball-2027-teams.json.
 * That file is stale against the current 2025/26 rosters (it lists `ipswich` where disk
 * has `burnley`, `betis` vs `real-betis`, `ac-milan` vs `milan`, plus 9 promotion and
 * relegation changes), so 12 of its 108 entries have no logo at any size.
 */
function loadPoolFromDisk(): { folder: string; slug: string }[] {
  const out: { folder: string; slug: string }[] = []
  for (const folder of POOL_LEAGUES) {
    const sizeDir = path.join(LOGO_DIR, folder, SIZE)
    if (!existsSync(sizeDir)) continue
    for (const file of readdirSync(sizeDir)) {
      if (!file.toLowerCase().endsWith('.png')) continue
      out.push({ folder, slug: file.replace(/\.png$/i, '') })
    }
  }
  return out
}

async function loadEfaClubs(): Promise<{ name: string; username: string | null; folder: string; slug: string }[]> {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  const res = await client.query(`
    select tm.name as name, pr.username as username,
           tm.logo_league_folder as folder, tm.logo_team_slug as slug
    from tournament_participants p
    join tournaments t on t.id = p.tournament_id
    join teams tm on tm.id = p.team_id
    left join profiles pr on pr.id = p.user_id
    where t.season_id = (select id from seasons where name = 'Season 4')
      and t.type = 'league'
    order by t.settings->>'division', tm.name
  `)
  await client.end()
  return res.rows
}

async function main() {
  const efaRows = await loadEfaClubs()
  const poolRows = loadPoolFromDisk()
  const inspect = process.argv.slice(2).filter((a) => !a.startsWith('-'))

  const missing: string[] = []
  const efaPalettes: Palette[] = []
  for (const row of efaRows) {
    try {
      efaPalettes.push({ key: row.slug, label: row.name, league: row.folder, colours: await extractPalette(row.folder, row.slug) })
    } catch (e) {
      missing.push(`${row.name}: ${(e as Error).message}`)
    }
  }

  const poolPalettes: Palette[] = []
  for (const row of poolRows) {
    try {
      poolPalettes.push({ key: row.slug, label: slugToDisplayName(row.slug), league: getLeagueDisplayName(row.folder), colours: await extractPalette(row.folder, row.slug) })
    } catch (e) {
      missing.push(`${row.slug}: ${(e as Error).message}`)
    }
  }

  console.error(`[palettes] EFA=${efaPalettes.length}/${efaRows.length}  pool=${poolPalettes.length}/${poolRows.length}`)
  if (missing.length) console.error(`[palettes] SKIPPED (${missing.length}): ${missing.join('; ')}`)

  if (inspect.length) {
    console.log('\n### Inspect\n')
    for (const p of [...efaPalettes, ...poolPalettes]) {
      if (!inspect.some((n) => p.label.toLowerCase().includes(n.toLowerCase()) || p.key.toLowerCase().includes(n.toLowerCase()))) continue
      console.log(
        `${p.label.padEnd(26)} [${getLeagueDisplayName(p.league) || p.league}]\n  ` +
          (p.colours.map((c) => `${c.family} ${c.hex} ${(c.share * 100).toFixed(0)}%`).join('  ') || '(none)')
      )
    }
    return
  }

  const allScores: number[] = []
  const results = efaPalettes.map((efa) => {
    const ranked = poolPalettes
      .map((pool) => ({ pool, score: scorePair(efa, pool) }))
      .sort((x, y) => x.score - y.score)
    allScores.push(ranked[0].score)
    return { efa, ranked }
  })

  const sorted = [...allScores].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.error(`[palettes] best-score: median=${median.toFixed(3)} worst=${sorted[sorted.length - 1].toFixed(3)}`)

  // Greedy one-to-one matching over the full score matrix. Two EFA clubs sharing a
  // crest would look identical on opposite sides of a fixture, so the plain "closest"
  // ranking is only safe once collisions are broken.
  const pairs: { efaIdx: number; pool: Palette; score: number }[] = []
  efaPalettes.forEach((efa, efaIdx) => {
    for (const pool of poolPalettes) pairs.push({ efaIdx, pool, score: scorePair(efa, pool) })
  })
  pairs.sort((a, b) => a.score - b.score)
  const takenEfa = new Set<number>()
  const takenPool = new Set<string>()
  const uniquePick = new Map<number, { pool: Palette; score: number }>()
  for (const p of pairs) {
    if (takenEfa.has(p.efaIdx) || takenPool.has(p.pool.key)) continue
    takenEfa.add(p.efaIdx)
    takenPool.add(p.pool.key)
    uniquePick.set(p.efaIdx, { pool: p.pool, score: p.score })
  }
  const reuse = new Map<string, number>()
  for (const p of poolPalettes) reuse.set(p.key, 0)
  for (const p of uniquePick.values()) reuse.set(p.pool.key, (reuse.get(p.pool.key) ?? 0) + 1)
  console.error(`[palettes] unique assignment: ${uniquePick.size}/${efaPalettes.length} clubs, collisions=${[...reuse.values()].filter((n) => n > 1).length}`)

  const rows = results.map(({ efa, ranked }, efaIdx) => {
    const best = ranked[0]
    const uniq = uniquePick.get(efaIdx)
    const alts = ranked.slice(1, 3)
    const weak = best.score > median * 1.6
    // only flag a genuine tie, not the inevitable closeness of the top few out of 108
    const gap = alts.length ? (best.score - alts[0].score) / best.score : 1
    const ambiguous = gap < 0.008
    const top = efa.colours[0]
    const lowSignal = efa.colours.length < 2 || (!!top && top.share > 0.85)
    const collided = !!uniq && uniq.pool.key !== best.pool.key
    return {
      club: efa.label,
      manager: efaRows.find((r) => r.slug === efa.key)?.username ?? null,
      colours: efa.colours.map((c) => c.family),
      palette: efa.colours.map((c) => c.hex),
      suggestion: best.pool.label,
      suggestionLeague: best.pool.league,
      suggestionColours: best.pool.colours.map((c) => c.family),
      score: Number(best.score.toFixed(4)),
      uniqueSuggestion: uniq ? uniq.pool.label : null,
      uniqueLeague: uniq ? uniq.pool.league : null,
      uniqueScore: uniq ? Number(uniq.score.toFixed(4)) : null,
      alts: alts.map((a) => `${a.pool.label} (${a.pool.league})`),
      flags: [
        weak ? 'WEAK' : null,
        ambiguous ? 'TOP-2 WITHIN 0.8%' : null,
        lowSignal ? 'LOW-SIGNAL CREST' : null,
        collided ? `UNIQUE: ${uniq!.pool.label}` : null,
      ].filter(Boolean) as string[],
    }
  })

  const sw = (hexes: string[]) => hexes.map((h) => `\`${h}\``).join(' ')

  console.log('\n## Suggested eFootball clubs by crest colour\n')
  console.log('| EFA club | Manager | Crest colours | Closest | Colour eq. | Reserved pick | Flag |')
  console.log('|---|---|---|---|---|---|---|')
  for (const r of rows) {
    const mgr = r.manager ?? '*vacant*'
    const reserved = r.uniqueSuggestion ? `${r.uniqueSuggestion} (${r.uniqueLeague})` : '—'
    console.log(`| ${r.club} | @${mgr} | ${r.colours.join(', ')} | **${r.suggestion}** (${r.suggestionLeague}) | ${r.suggestionColours.join(', ')} | ${reserved} | ${r.flags.join(' ') || ''} |`)
  }
  console.log(`\nCrest hex: ${rows.map((r) => `${r.club} ${sw(r.palette)}`).join(' · ')}`)
  console.log(`\nAlso close: ${rows.map((r) => `${r.club} -> ${r.alts.join('; ') || '—'}`).join(' · ')}`)

  const outDir = path.join(process.cwd(), 'node_modules', '.cache')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, 'club-palettes.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pool: poolRows.length, rows }, null, 2))
  console.error(`[palettes] wrote node_modules/.cache/club-palettes.json`)
}

main().catch((e) => {
  console.error('[palettes] ERROR:', e)
  process.exit(1)
})
