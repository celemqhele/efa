import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { CoverPage, PageHeader, Footer, Intro, Gold, styles as shared } from './shared'

const NAVY = '#0a1128'
const NAVY_DEEP = '#05080f'
const GOLD = '#D6B65D'
const WHITE = '#F7FAFC'
const MUTED = '#94A3B8'
const CARD = '#111a33'
const BORDER = '#23305c'
const GREEN = '#34d399'
const RED = '#f56565'

const styles = StyleSheet.create({
  page: { ...shared.page, padding: 24, paddingBottom: 40 },
  introBlock: { marginBottom: 6 },
  introText: {
    color: WHITE,
    fontSize: 9.5,
    lineHeight: 1.55,
    marginBottom: 4,
  },
  tableWrap: { marginTop: 3, borderRadius: 8, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: NAVY_DEEP,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowLast: { flexDirection: 'row' },
  cellRank: { width: 30, paddingVertical: 2.5, paddingHorizontal: 7 },
  cellManager: { flex: 1, paddingVertical: 2.5, paddingHorizontal: 7 },
  cellNum: { width: 38, paddingVertical: 2.5, paddingHorizontal: 7 },
  headText: {
    color: GOLD,
    fontSize: 6.5,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  cellManagerText: { color: WHITE, fontSize: 7.5 },
  cellNumText: { color: WHITE, fontSize: 7.5, textAlign: 'center' },
  rowTop: { backgroundColor: 'rgba(52, 211, 153, 0.08)' },
  rowBottom: { backgroundColor: 'rgba(245, 101, 101, 0.06)' },
  splitRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  splitCol: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  splitBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitTitle: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5 },
  splitSub: { fontSize: 7.5, color: MUTED, letterSpacing: 1 },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  splitItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  splitRank: { width: 22, color: MUTED, fontSize: 9, fontWeight: 600 },
  splitName: { flex: 1, color: WHITE, fontSize: 9.5 },
  splitPts: { width: 40, color: GOLD, fontSize: 8.5, textAlign: 'right' },
  note: {
    color: MUTED,
    fontSize: 7,
    lineHeight: 1.45,
    marginTop: 6,
  },
})

const MANAGERS: { name: string; pts: number; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number }[] = [
  { name: 'minenhle22', pts: 18, p: 6, w: 6, d: 0, l: 0, gf: 32, ga: 10, gd: 22 },
  { name: 'uvesh', pts: 18, p: 6, w: 6, d: 0, l: 0, gf: 31, ga: 9, gd: 22 },
  { name: 'Terrence', pts: 15, p: 6, w: 5, d: 0, l: 1, gf: 43, ga: 18, gd: 25 },
  { name: 'skoozz420', pts: 15, p: 6, w: 5, d: 0, l: 1, gf: 25, ga: 6, gd: 19 },
  { name: 'tildedot', pts: 15, p: 6, w: 5, d: 0, l: 1, gf: 25, ga: 17, gd: 8 },
  { name: 'tbhotouch', pts: 13, p: 6, w: 4, d: 1, l: 1, gf: 23, ga: 12, gd: 11 },
  { name: 'siyambonga23', pts: 13, p: 6, w: 4, d: 1, l: 0, gf: 24, ga: 14, gd: 10 },
  { name: 'goat_2', pts: 12, p: 6, w: 4, d: 0, l: 2, gf: 19, ga: 12, gd: 7 },
  { name: 'wandile', pts: 10, p: 6, w: 3, d: 1, l: 1, gf: 25, ga: 12, gd: 13 },
  { name: 'jobe', pts: 10, p: 6, w: 3, d: 1, l: 2, gf: 28, ga: 22, gd: 6 },
  { name: 'loki', pts: 10, p: 6, w: 3, d: 1, l: 2, gf: 17, ga: 13, gd: 4 },
  { name: 'siyethemba_', pts: 10, p: 6, w: 3, d: 1, l: 2, gf: 21, ga: 21, gd: 0 },
  { name: 'itumeleng_99', pts: 9, p: 6, w: 3, d: 0, l: 3, gf: 19, ga: 16, gd: 3 },
  { name: 'ozilotf', pts: 9, p: 6, w: 3, d: 0, l: 2, gf: 16, ga: 14, gd: 2 },
  { name: 'calvin', pts: 9, p: 6, w: 3, d: 0, l: 3, gf: 11, ga: 12, gd: -1 },
  { name: 'parmalat_', pts: 9, p: 6, w: 3, d: 0, l: 3, gf: 18, ga: 29, gd: -11 },
  { name: 'ghost', pts: 10, p: 6, w: 3, d: 1, l: 1, gf: 20, ga: 11, gd: 9 },
  { name: 'blessing_100sk', pts: 7, p: 6, w: 2, d: 1, l: 1, gf: 11, ga: 8, gd: 3 },
  { name: 'jigsaw_rsa', pts: 7, p: 6, w: 2, d: 1, l: 2, gf: 16, ga: 15, gd: 1 },
  { name: 'anele_arh', pts: 7, p: 6, w: 2, d: 1, l: 3, gf: 18, ga: 22, gd: -4 },
  { name: '4gxzo', pts: 6, p: 6, w: 2, d: 0, l: 3, gf: 13, ga: 24, gd: -11 },
  { name: 'khumoshxta', pts: 5, p: 6, w: 1, d: 2, l: 2, gf: 10, ga: 15, gd: -5 },
  { name: 'badbouycee', pts: 5, p: 6, w: 1, d: 2, l: 3, gf: 20, ga: 33, gd: -13 },
  { name: 'celemqhele', pts: 4, p: 6, w: 1, d: 1, l: 4, gf: 16, ga: 23, gd: -7 },
  { name: 'm_a_s_h_a_u', pts: 4, p: 6, w: 1, d: 1, l: 3, gf: 13, ga: 23, gd: -10 },
  { name: 'vuyo', pts: 4, p: 6, w: 1, d: 1, l: 4, gf: 16, ga: 34, gd: -18 },
  { name: 'phiwayinkosi', pts: 3, p: 6, w: 1, d: 0, l: 3, gf: 13, ga: 14, gd: -1 },
  { name: 'le2_radebe', pts: 3, p: 6, w: 1, d: 0, l: 2, gf: 8, ga: 11, gd: -3 },
  { name: 'hlabaking103', pts: 3, p: 6, w: 1, d: 0, l: 4, gf: 7, ga: 14, gd: -7 },
  { name: 'NAITOR', pts: 1, p: 6, w: 0, d: 1, l: 4, gf: 7, ga: 15, gd: -8 },
  { name: 'maninblack', pts: 0, p: 6, w: 0, d: 0, l: 6, gf: 4, ga: 20, gd: -16 },
  { name: 'loneprsly', pts: 0, p: 6, w: 0, d: 0, l: 6, gf: 9, ga: 38, gd: -29 },
]

const PSL = MANAGERS.slice(0, 16)
const MOTSEPE = MANAGERS.slice(16)

const HEAD_CELLS = ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS']

function TableHead({ first }: { first?: boolean }) {
  return (
    <View style={styles.tableHead}>
      <View style={styles.cellRank}>
        <Text style={styles.headText}>{first ? '#' : ' '}</Text>
      </View>
      <View style={styles.cellManager}>
        <Text style={styles.headText}>{first ? 'MANAGER' : ''}</Text>
      </View>
      {HEAD_CELLS.map((c) => (
        <View style={styles.cellNum} key={c}>
          <Text style={styles.headText}>{first ? c : ''}</Text>
        </View>
      ))}
    </View>
  )
}

function ManagerRow({
  idx,
  m,
  last,
}: {
  idx: number
  m: { name: string; pts: number; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number }
  last?: boolean
}) {
  const gdStr = m.gd > 0 ? `+${m.gd}` : String(m.gd)
  return (
    <View style={[last ? styles.tableRowLast : styles.tableRow, idx < 16 ? styles.rowTop : styles.rowBottom]}>
      <View style={styles.cellRank}>
        <Text style={[styles.cellNumText, { color: idx < 16 ? GREEN : RED, fontWeight: 700 }]}>{idx + 1}</Text>
      </View>
      <View style={styles.cellManager}>
        <Text style={styles.cellManagerText}>{m.name}</Text>
      </View>
      {[m.p, m.w, m.d, m.l, m.gf, m.ga, gdStr, m.pts].map((v, i) => (
        <View style={styles.cellNum} key={i}>
          <Text style={styles.cellNumText}>{v}</Text>
        </View>
      ))}
    </View>
  )
}

function RankTable({ rows }: { rows: typeof MANAGERS }) {
  return (
    <View style={styles.tableWrap}>
      <TableHead first />
      {rows.map((m, i) => (
        <ManagerRow idx={i} m={m} key={m.name} last={i === rows.length - 1} />
      ))}
    </View>
  )
}

function SplitColumn({
  title,
  sub,
  color,
  items,
}: {
  title: string
  sub: string
  color: string
  items: typeof MANAGERS
}) {
  return (
    <View style={styles.splitCol}>
      <View style={styles.splitHeader}>
        <View style={[styles.splitBadge, { backgroundColor: color }]}>
          <Text style={{ color: NAVY, fontSize: 11, fontWeight: 700 }}>{items.length === 16 ? '1' : '2'}</Text>
        </View>
        <View>
          <Text style={[styles.splitTitle, { color }]}>{title}</Text>
          <Text style={styles.splitSub}>{sub}</Text>
        </View>
      </View>
      {items.map((m, i) => (
        <View style={i === items.length - 1 ? styles.splitItemLast : styles.splitItem} key={m.name}>
          <Text style={styles.splitRank}>{i + 1}</Text>
          <Text style={styles.splitName}>{m.name}</Text>
          <Text style={styles.splitPts}>{m.pts} pts</Text>
        </View>
      ))}
    </View>
  )
}

function Cover() {
  return (
    <CoverPage
      title="EFA OFFICIAL ANNOUNCEMENT"
      subtitle="2026 LEAGUE PLACEMENT"
      tagline="Based on Performance in the EFA International Cup"
    />
  )
}

function OverallTable() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title="OFFICIAL ANNOUNCEMENT" />
      <View style={styles.introBlock}>
        <Intro>
          The EFA League announces the division placement of all 32 managers, decided by performance in
          the <Gold>EFA International Cup</Gold> group stage. The top 16 go to the{' '}
          <Gold>PSL (First Division)</Gold>; the remaining 16 go to the{' '}
          <Gold>Motsepe Foundation Championship (Second Division)</Gold>.
        </Intro>
        <Text style={styles.note}>
          Ranking — points, then goal difference, then goals scored. Managers will select their clubs for the
          upcoming season; team selection details follow.
        </Text>
      </View>
      <RankTable rows={MANAGERS} />
    </Page>
  )
}

function DivisionSplit() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title="2026 LEAGUE PLACEMENT" />
      <Intro>
        Based on group-stage performance in the <Gold>EFA International Cup</Gold>.
      </Intro>
      <View style={styles.splitRow}>
        <SplitColumn
          title="PSL"
          sub="FIRST DIVISION · TOP 16"
          color={GREEN}
          items={PSL}
        />
        <SplitColumn
          title="MOTSEPE"
          sub="SECOND DIVISION · BOTTOM 16"
          color={RED}
          items={MOTSEPE}
        />
      </View>
      <Footer />
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Official Announcement — League Placement"
    author="Efootball Federal Association"
    subject="PSL / Motsepe division placement based on the EFA International Cup"
  >
    <Cover />
    <OverallTable />
    <DivisionSplit />
  </Document>
)

export default doc