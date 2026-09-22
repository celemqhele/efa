import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Svg, Line, Path } from '@react-pdf/renderer'
import path from 'path'
import { pathToFileURL } from 'url'
import { LOGO, NAVY, NAVY_DEEP, GOLD, GOLD_BRIGHT, WHITE, MUTED, CARD, BORDER } from './shared'

const PAGE_W = 1280
const PAGE_H = 720
const LEAGUE = 'fifa-world-cup-2026.football-logos.cc'

export const LOGO_CACHE_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'bracket', 'logos')

function teamLogo(slug: string): string {
  return pathToFileURL(
    path.join(LOGO_CACHE_DIR, `${slug}.png`)
  ).href
}

const LINE = GOLD

const styles = StyleSheet.create({
  page: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: NAVY,
    fontFamily: 'Poppins',
    position: 'relative',
    overflow: 'hidden',
  },
  logo: { position: 'absolute', top: 22, left: 40, width: 46, height: 46 },
  title: {
    position: 'absolute',
    top: 26,
    left: 0,
    width: PAGE_W,
    textAlign: 'center',
    color: GOLD,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 3,
  },
  subtitle: {
    position: 'absolute',
    top: 58,
    left: 0,
    width: PAGE_W,
    textAlign: 'center',
    color: WHITE,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: 7,
  },
  divider: {
    position: 'absolute',
    top: 88,
    left: 60,
    width: PAGE_W - 120,
    height: 1,
    backgroundColor: BORDER,
  },
  colLabel: {
    position: 'absolute',
    top: 104,
    color: MUTED,
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  r16Box: {
    position: 'absolute',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
  },
  stageBox: {
    position: 'absolute',
    backgroundColor: NAVY_DEEP,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 8,
  },
  finalBox: {
    position: 'absolute',
    backgroundColor: NAVY_DEEP,
    borderWidth: 2,
    borderColor: GOLD_BRIGHT,
    borderRadius: 10,
  },
  teamName: { color: WHITE, fontSize: 9, fontWeight: 600, textAlign: 'center' },
  managerName: { color: MUTED, fontSize: 6, textAlign: 'center' },
  vsText: { color: GOLD, fontSize: 9, fontWeight: 700, textAlign: 'center' },
  mdTag: { color: MUTED, fontSize: 6, letterSpacing: 1 },
  stageHead: { color: GOLD, fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textAlign: 'center' },
  stageRow: { color: WHITE, fontSize: 9, fontWeight: 600 },
  stageSub: { color: MUTED, fontSize: 6 },
  stageVs: { color: GOLD_BRIGHT, fontSize: 8, fontWeight: 700, textAlign: 'center' },
  finalHead: { color: GOLD_BRIGHT, fontSize: 12, fontWeight: 700, letterSpacing: 2, textAlign: 'center' },
  finalRow: { color: WHITE, fontSize: 9.5, fontWeight: 600 },
  footNoteBox: {
    position: 'absolute',
    top: 642,
    left: 0,
    width: PAGE_W,
    alignItems: 'center',
  },
  footNote: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    textAlign: 'center',
    backgroundColor: NAVY_DEEP,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  footSub: {
    position: 'absolute',
    top: 690,
    left: 0,
    width: PAGE_W,
    textAlign: 'center',
    color: MUTED,
    fontSize: 7,
    letterSpacing: 3,
  },
})

const R16_W = 250
const R16_H = 96

type R16Team = { name: string; slug: string; mgr: string }
type R16 = {
  md: string
  home: R16Team
  away: R16Team
  x: number
  y: number
}

function TbcIcon({ x, y, size = 15, color = GOLD_BRIGHT }: { x: number; y: number; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y }}>
      <Path
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M12 17h.01" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  )
}

function TeamSlot({ t, cx }: { t: R16Team; cx: number }) {
  return (
    <>
      <Image
        src={teamLogo(t.slug)}
        style={{ position: 'absolute', left: cx - 26, top: 6, width: 52, height: 52 }}
      />
      <Text style={[styles.teamName, { position: 'absolute', left: cx - 62, top: 60, width: 124 }]}>{t.name}</Text>
      <Text style={[styles.managerName, { position: 'absolute', left: cx - 62, top: 74, width: 124 }]}>
        ({t.mgr})
      </Text>
    </>
  )
}

function R16Box({ r }: { r: R16 }) {
  return (
    <View style={[styles.r16Box, { left: r.x, top: r.y, width: R16_W, height: R16_H }]}>
      <Text style={[styles.mdTag, { position: 'absolute', top: 6, right: 10 }]}>{r.md}</Text>
      <TeamSlot t={r.home} cx={R16_W * 0.25} />
      <Text style={[styles.vsText, { position: 'absolute', top: 40, left: R16_W / 2 - 10, width: 20 }]}>VS</Text>
      <TeamSlot t={r.away} cx={R16_W * 0.75} />
    </View>
  )
}

type Stage = {
  kind: 'qf' | 'sf' | 'final'
  label: string
  row1: string
  sub1?: string
  row2: string
  sub2?: string
  x: number
  y: number
  w: number
  h: number
}

function StageBox({ s }: { s: Stage }) {
  const box = s.kind === 'final' ? styles.finalBox : styles.stageBox
  const isFinal = s.kind === 'final'
  const headStyle = isFinal ? styles.finalHead : styles.stageHead
  const rowStyle = isFinal ? styles.finalRow : styles.stageRow
  const subStyle = isFinal ? styles.stageSub : styles.stageSub
  const iconSize = isFinal ? 20 : 15
  const headY = isFinal ? 12 : 10
  const rowW = s.w - 46
  const rowX = 38
  const slot1Y = s.h * (isFinal ? 0.32 : 0.3)
  const slot2Y = s.h * (isFinal ? 0.66 : 0.64)
  const vsY = s.h * 0.5 - 5
  return (
    <View style={[box, { left: s.x, top: s.y, width: s.w, height: s.h }]}>
      <Text style={[headStyle, { position: 'absolute', top: headY, left: 0, width: s.w }]}>{s.label}</Text>

      <TbcIcon x={12} y={slot1Y - iconSize / 2} size={iconSize} />
      <Text style={[rowStyle, { position: 'absolute', left: rowX, top: slot1Y - 6, width: rowW }]}>{s.row1}</Text>
      {s.sub1 ? (
        <Text style={[subStyle, { position: 'absolute', left: rowX, top: slot1Y + 8, width: rowW }]}>{s.sub1}</Text>
      ) : null}

      <View
        style={{
          position: 'absolute',
          top: vsY + 5,
          left: s.w * 0.16,
          width: s.w * 0.68,
          height: 1,
          backgroundColor: BORDER,
        }}
      />

      <TbcIcon x={12} y={slot2Y - iconSize / 2} size={iconSize} />
      <Text style={[rowStyle, { position: 'absolute', left: rowX, top: slot2Y - 6, width: rowW }]}>{s.row2}</Text>
      {s.sub2 ? (
        <Text style={[subStyle, { position: 'absolute', left: rowX, top: slot2Y + 8, width: rowW }]}>{s.sub2}</Text>
      ) : null}
    </View>
  )
}

const r16Core: Omit<R16, 'x' | 'y'>[] = [
  {
    md: 'MD 51',
    home: { name: 'Norway', slug: 'norway', mgr: 'wandile' },
    away: { name: 'Brazil', slug: 'brazil', mgr: 'tildedot' },
  },
  {
    md: 'MD 52',
    home: { name: 'Tunisia', slug: 'tunisia', mgr: 'jobe' },
    away: { name: 'Switzerland', slug: 'switzerland', mgr: 'minenhle22' },
  },
  {
    md: 'MD 53',
    home: { name: 'Belgium', slug: 'belgium', mgr: 'siyethemba_' },
    away: { name: 'England', slug: 'england', mgr: 'parmalat_' },
  },
  {
    md: 'MD 54',
    home: { name: 'Morocco', slug: 'morocco', mgr: 'Terrence' },
    away: { name: 'Sweden', slug: 'sweden', mgr: 'siyambonga23' },
  },
  {
    md: 'MD 55',
    home: { name: 'France', slug: 'france', mgr: 'goat_2' },
    away: { name: 'Cabo Verde', slug: 'cabo-verde', mgr: 'uvesh' },
  },
  {
    md: 'MD 56',
    home: { name: 'Spain', slug: 'spain', mgr: 'calvin' },
    away: { name: 'USA', slug: 'usa', mgr: 'tbhotouch' },
  },
  {
    md: 'MD 57',
    home: { name: 'Egypt', slug: 'egypt', mgr: 'ghost' },
    away: { name: 'South Korea', slug: 'south-korea', mgr: 'skoozz420' },
  },
  {
    md: 'MD 58',
    home: { name: 'Senegal', slug: 'senegal', mgr: 'loki' },
    away: { name: 'Cote D Ivoire', slug: 'cote-d-ivoire', mgr: 'blessing_100sk' },
  },
]

export const ALL_TEAM_SLUGS = r16Core.flatMap((r) => [r.home.slug, r.away.slug])

// ── geometry ────────────────────────────────────────────────────────────────
const R16_LEFT_Y = [137, 247, 397, 507]
const R16_RIGHT_Y = [137, 247, 397, 507]
const r16L = r16Core.slice(0, 4).map((r, i) => ({ ...r, x: 40, y: R16_LEFT_Y[i] }))
const r16R = r16Core.slice(4, 8).map((r, i) => ({ ...r, x: 990, y: R16_RIGHT_Y[i] }))

const QF_W = 150
const QF_H = 104
const qf1 = { kind: 'qf' as const, label: 'QF 1', row1: 'Winner 51', sub1: 'Norway · Brazil', row2: 'Winner 52', sub2: 'Tunisia · Switzerland', x: 300, y: 188, w: QF_W, h: QF_H }
const qf2 = { kind: 'qf' as const, label: 'QF 2', row1: 'Winner 53', sub1: 'Belgium · England', row2: 'Winner 54', sub2: 'Morocco · Sweden', x: 300, y: 448, w: QF_W, h: QF_H }
const qf3 = { kind: 'qf' as const, label: 'QF 3', row1: 'Winner 55', sub1: 'France · Cabo Verde', row2: 'Winner 56', sub2: 'Spain · USA', x: 830, y: 188, w: QF_W, h: QF_H }
const qf4 = { kind: 'qf' as const, label: 'QF 4', row1: 'Winner 57', sub1: 'Egypt · South Korea', row2: 'Winner 58', sub2: 'Senegal · Cote D Ivoire', x: 830, y: 448, w: QF_W, h: QF_H }

const SF_W = 110
const SF_H = 120
const sf1 = { kind: 'sf' as const, label: 'SF 1', row1: 'Winner QF1', row2: 'Winner QF2', x: 470, y: 310, w: SF_W, h: SF_H }
const sf2 = { kind: 'sf' as const, label: 'SF 2', row1: 'Winner QF3', row2: 'Winner QF4', x: 700, y: 310, w: SF_W, h: SF_H }

const F_W = 120
const F_H = 132
const final = { kind: 'final' as const, label: 'FINAL', row1: 'Winner SF1', row2: 'Winner SF2', x: 580, y: 304, w: F_W, h: F_H }

const LINE_S = 2.5

const B = {
  // left half feeds (R16 right edge x=290 -> junction x=295 -> QF left edge x=300)
  md51: [290, 185, 295, 185, 295, 240, 300, 240],
  md52: [290, 295, 295, 295, 295, 240, 300, 240],
  md53: [290, 445, 295, 445, 295, 500, 300, 500],
  md54: [290, 555, 295, 555, 295, 500, 300, 500],
  // left QF -> SF1 (QF right edge x=450 -> junction x=460 -> SF left edge x=470)
  qf1_out: [450, 240, 460, 240, 460, 370, 470, 370],
  qf2_out: [450, 500, 460, 500, 460, 370, 470, 370],
  // right half feeds (R16 left edge x=990 -> junction x=985 -> QF right edge x=980)
  md55: [990, 185, 985, 185, 985, 240, 980, 240],
  md56: [990, 295, 985, 295, 985, 240, 980, 240],
  md57: [990, 445, 985, 445, 985, 500, 980, 500],
  md58: [990, 555, 985, 555, 985, 500, 980, 500],
  // right QF -> SF2 (QF left edge x=830 -> junction x=820 -> SF right edge x=810)
  qf3_out: [830, 240, 820, 240, 820, 370, 810, 370],
  qf4_out: [830, 500, 820, 500, 820, 370, 810, 370],
}

function Connectors() {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
  Object.values(B).forEach((pts) => {
    for (let i = 0; i < pts.length - 3; i += 2) {
      segs.push({ x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3] })
    }
  })
  return (
    <Svg width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      {segs.map((s, i) => (
        <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={LINE} strokeWidth={LINE_S} />
      ))}
    </Svg>
  )
}

function ColLabels() {
  const labels: { text: string; x: number }[] = [
    { text: 'ROUND OF 16', x: 165 },
    { text: 'QUARTER-FINALS', x: 375 },
    { text: 'SEMI-FINALS', x: 525 },
    { text: 'FINAL', x: 640 },
    { text: 'SEMI-FINALS', x: 755 },
    { text: 'QUARTER-FINALS', x: 905 },
    { text: 'ROUND OF 16', x: 1115 },
  ]
  return (
    <>
      {labels.map((l) => (
        <Text key={l.text} style={[styles.colLabel, { left: l.x - 60, width: 120 }]}>
          {l.text}
        </Text>
      ))}
    </>
  )
}

function FooterNote() {
  return (
    <>
      <View style={styles.footNoteBox}>
        <Text style={styles.footNote}>FIXTURES WILL BE RELEASED 21 SEPTEMBER 23:30</Text>
      </View>
      <Text style={styles.footSub}>EFA INTERNATIONAL CUP 2026 · KNOCKOUT STAGE</Text>
    </>
  )
}

const doc = (
  <Document title="EFA International Cup 2026 — Knockout Stage" author="Efootball Federal Association">
    <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
      <Image src={LOGO} style={styles.logo} />
      <Text style={styles.title}>EFA INTERNATIONAL CUP 2026</Text>
      <Text style={styles.subtitle}>KNOCKOUT STAGE</Text>
      <View style={styles.divider} />

      <ColLabels />
      <Connectors />

      {r16L.map((r) => <R16Box key={r.md} r={r} />)}
      {r16R.map((r) => <R16Box key={r.md} r={r} />)}

      <StageBox s={qf1} />
      <StageBox s={qf2} />
      <StageBox s={sf1} />
      <StageBox s={final} />
      <StageBox s={sf2} />
      <StageBox s={qf3} />
      <StageBox s={qf4} />

      <FooterNote />
    </Page>
  </Document>
)

export default doc