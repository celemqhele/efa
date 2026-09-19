import React from 'react'
import { Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'
import { pathToFileURL } from 'url'

const FONT_DIR = path.join(process.cwd(), 'scripts', 'assets', 'fonts')
export const LOGO = pathToFileURL(path.join(process.cwd(), 'public', 'efa-logo-white.png')).href

Font.register({
  family: 'Poppins',
  fonts: [
    { src: path.join(FONT_DIR, 'Poppins-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Poppins-Medium.ttf'), fontWeight: 500 },
    { src: path.join(FONT_DIR, 'Poppins-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'Poppins-Bold.ttf'), fontWeight: 700 },
  ],
})

export const NAVY = '#0a1128'
export const NAVY_DEEP = '#05080f'
export const GOLD = '#D6B65D'
export const GOLD_BRIGHT = '#E3C677'
export const WHITE = '#F7FAFC'
export const MUTED = '#94A3B8'
export const CARD = '#111a33'
export const BORDER = '#23305c'

export const styles = StyleSheet.create({
  page: {
    backgroundColor: NAVY,
    fontFamily: 'Poppins',
    color: WHITE,
    padding: 40,
    position: 'relative',
  },
  cover: {
    backgroundColor: NAVY_DEEP,
  },
  coverInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  coverLogo: {
    width: 180,
    height: 180,
    marginBottom: 28,
  },
  coverRing: {
    position: 'absolute',
    top: '22%',
    left: '50%',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: GOLD,
    opacity: 0.35,
    marginLeft: -160,
  },
  coverTitle: {
    color: GOLD,
    fontSize: 34,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 10,
  },
  coverSubtitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: 500,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 8,
  },
  coverTagline: {
    color: MUTED,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  coverFooterText: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLogo: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  headerTitle: {
    color: GOLD,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 2,
  },
  headerRight: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    color: MUTED,
    fontSize: 8,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionBar: {
    width: 4,
    height: 18,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start',
  },
  rowLast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop: 6,
    marginRight: 10,
  },
  rowText: {
    flex: 1,
    color: WHITE,
    fontSize: 11,
    lineHeight: 1.6,
  },
  rowLabel: {
    color: GOLD_BRIGHT,
    fontWeight: 600,
  },
  cardTitle: {
    color: GOLD,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  intro: {
    color: WHITE,
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 2,
  },
  introHighlight: {
    color: GOLD,
    fontWeight: 600,
  },
  warning: {
    color: '#F56565',
    fontWeight: 600,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  check: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GOLD,
    color: NAVY,
    fontSize: 9,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 14,
    marginRight: 10,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: NAVY_DEEP,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableCellCol: {
    width: 90,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  tableCellRestart: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tableHeadText: {
    color: GOLD,
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1,
  },
  tableDisconnect: {
    color: GOLD_BRIGHT,
    fontSize: 10,
    fontWeight: 600,
  },
  tableRestart: {
    color: WHITE,
    fontSize: 10,
    lineHeight: 1.5,
  },
  tableNote: {
    color: MUTED,
    fontSize: 9.5,
    lineHeight: 1.5,
    marginTop: 6,
  },
})

export function CoverPage({
  title,
  subtitle,
  tagline,
}: {
  title: string
  subtitle: string
  tagline?: string
}) {
  return (
    <Page size="A4" style={[styles.page, styles.cover]}>
      <View style={styles.coverRing} />
      <View style={styles.coverInner}>
        <Image src={LOGO} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>{title}</Text>
        <Text style={styles.coverSubtitle}>{subtitle}</Text>
        {tagline ? <Text style={styles.coverTagline}>{tagline}</Text> : null}
      </View>
      <View style={styles.coverFooter}>
        <Text style={styles.coverFooterText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

export function PageHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Image src={LOGO} style={styles.headerLogo} />
      <View style={styles.headerRight}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  )
}

export function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>EFA — EFOOTBALL FEDERAL ASSOCIATION</Text>
      <Text style={styles.footerText}>PLAY • COMPETE • REPRESENT</Text>
    </View>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Row({
  label,
  last,
  children,
}: {
  label?: React.ReactNode
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <View style={last ? styles.rowLast : styles.row}>
      <View style={styles.bullet} />
      <Text style={styles.rowText}>
        {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
        {label ? ' ' : null}
        {children}
      </Text>
    </View>
  )
}

export function CheckRow({
  num,
  last,
  children,
}: {
  num: string
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <View style={last ? styles.checkRowLast : styles.checkRow}>
      <Text style={styles.check}>{num}</Text>
      <Text style={styles.rowText}>{children}</Text>
    </View>
  )
}

export function Intro({ children }: { children?: React.ReactNode }) {
  return <Text style={styles.intro}>{children}</Text>
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.rowLabel}>{children}</Text>
}

export function Gold({ children }: { children: React.ReactNode }) {
  return <Text style={styles.introHighlight}>{children}</Text>
}

export function Warn({ children }: { children: React.ReactNode }) {
  return <Text style={styles.warning}>{children}</Text>
}