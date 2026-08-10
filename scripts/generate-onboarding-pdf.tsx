import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { renderToFile } from '@react-pdf/renderer'
import path from 'path'
import { pathToFileURL } from 'url'

const FONT_DIR = path.join(process.cwd(), 'scripts', 'assets', 'fonts')
const LOGO = pathToFileURL(path.join(process.cwd(), 'public', 'efa-logo-white.png')).href
const OUT = path.join(process.cwd(), 'public', 'EFA-Onboarding.pdf')

Font.register({
  family: 'Poppins',
  fonts: [
    { src: path.join(FONT_DIR, 'Poppins-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Poppins-Medium.ttf'), fontWeight: 500 },
    { src: path.join(FONT_DIR, 'Poppins-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'Poppins-Bold.ttf'), fontWeight: 700 },
  ],
})

const NAVY = '#0a1128'
const NAVY_DEEP = '#05080f'
const GOLD = '#D6B65D'
const GOLD_BRIGHT = '#E3C677'
const WHITE = '#F7FAFC'
const MUTED = '#94A3B8'
const CARD = '#111a33'
const BORDER = '#23305c'

const styles = StyleSheet.create({
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
    fontSize: 13,
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

function CoverPage() {
  return (
    <Page size="A4" style={[styles.page, styles.cover]}>
      <View style={styles.coverRing} />
      <View style={styles.coverInner}>
        <Image src={LOGO} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>EFA MANAGER</Text>
        <Text style={styles.coverSubtitle}>ONBOARDING GUIDE</Text>
        <Text style={styles.coverTagline}>Efootball Federal Association</Text>
      </View>
      <View style={styles.coverFooter}>
        <Text style={styles.coverFooterText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

function PageHeader() {
  return (
    <View style={styles.header}>
      <Image src={LOGO} style={styles.headerLogo} />
      <View style={styles.headerRight}>
        <Text style={styles.headerTitle}>EFA MANAGER ONBOARDING GUIDE</Text>
      </View>
    </View>
  )
}

function RulesPage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader />

      {/* Welcome */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Welcome to the EFA</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.intro}>
            Welcome, Manager! You are now in control of your club in the{' '}
            <Text style={styles.introHighlight}>Efootball Federal Association (EFA)</Text>. Each week
            you'll be given fixtures to play against other managers in eFootball. Play your matches,
            submit your results, and climb the standings.
          </Text>
        </View>
      </View>

      {/* Match Settings */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Match Settings</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Match time:</Text> 10 minutes
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Stadium:</Text> Any (neutral preferred)
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Injuries:</Text> OFF
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Substitutions:</Text> 6 subs for both teams
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Conditions:</Text> Excellent for both players
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Kit:</Text> Always use your team's logo
            </Text>
          </View>
        </View>
      </View>

      {/* Gameplay Rules */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Gameplay Rules</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>No Smart Assist.</Text> Smart Assist is NOT allowed in any match.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>No cheating.</Text> No exploits, glitches, or unfair tactics.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>No quitting.</Text> Quitting mid-match{' '}
              <Text style={styles.warning}>counts as a loss</Text>.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Connection drop.</Text> If the network interrupts play,
              the match is <Text style={styles.rowLabel}>replayed</Text> from the point shown on the
              next page. If a player refuses to replay, it{' '}
              <Text style={styles.warning}>counts as a loss</Text> for the player who doesn't replay.
            </Text>
          </View>
        </View>
      </View>
    </Page>
  )
}

function DropsPage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader />

      {/* Connection Drops */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>If the Connection Drops</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              Find the minute the match was interrupted, then restart with the match time shown
              below. <Text style={styles.rowLabel}>Aggregate (agg) carries on</Text> — played minutes
              are not replayed.
            </Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <View style={styles.tableCellCol}>
                <Text style={styles.tableHeadText}>DISCONNECT</Text>
              </View>
              <View style={styles.tableCellRestart}>
                <Text style={styles.tableHeadText}>RESTART</Text>
              </View>
            </View>
            {[
              ['0 minutes', 'Full match, from the start'],
              ['10 minutes', 'Match at 9 minutes'],
              ['20 minutes', 'Match at 8 minutes'],
              ['30 minutes', 'Match at 7 minutes'],
              ['40 minutes', 'Match at 6 minutes'],
              ['50 minutes', 'Match at 5 minutes'],
              ['60 minutes', 'Match at 5 minutes'],
              ['70 minutes', 'Match at 5 minutes — first half only'],
              ['80 minutes', 'Match at 5 minutes — first half only'],
              ['90 minutes', 'No restart — match counts as finished'],
            ].map(([disconnect, restart], i) => {
              const last = i === 9
              const Row = last ? styles.tableRowLast : styles.tableRow
              return (
                <View key={i} style={Row}>
                  <View style={styles.tableCellCol}>
                    <Text style={styles.tableDisconnect}>{disconnect}</Text>
                  </View>
                  <View style={styles.tableCellRestart}>
                    <Text style={styles.tableRestart}>{restart}</Text>
                  </View>
                </View>
              )
            })}
          </View>
          <Text style={styles.tableNote}>
            If the players cannot agree on the disconnect minute, replay from the start of the match.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>EFA — EFOOTBALL FEDERAL ASSOCIATION</Text>
        <Text style={styles.footerText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

function InfoPage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader />

      {/* Match Week & Deadlines */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Match Week &amp; Deadlines</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              Fixtures are announced at the start of the week with your opponent's manager name.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Play your matches before Sunday.</Text>
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>Deadline:</Text> 23:30 — all matches must be completed by
              then.
            </Text>
          </View>
        </View>
      </View>

      {/* How to Play */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>How to Play Your Match</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>1. Message your opponent.</Text> Contact them on WhatsApp
              to arrange your match ("you have a match"). Manager names are listed in the
              announcements and fixtures group.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>2. Create the matchroom.</Text> If you're the home team,
              you create the matchroom and set up the match settings.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>3. Kick off.</Text> Use the exact match settings listed
              above.
            </Text>
          </View>
        </View>
      </View>

      {/* Submit Results */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Submitting Your Result</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              After the match, <Text style={styles.rowLabel}>submit your result to the EFA AI</Text>{' '}
              by sending a screenshot of the final score.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              Your opponent does the same. The EFA AI confirms and records the result.
            </Text>
          </View>
        </View>
      </View>

      {/* Backdoor */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Backdoor</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              If your opponent isn't responding, don't lose the match for nothing.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              Send <Text style={styles.rowLabel}>"backdoor"</Text> to the EFA AI when the backdoor
              window opens on <Text style={styles.rowLabel}>Thursday</Text>. The backdoor is a{' '}
              <Text style={styles.rowLabel}>free win</Text> awarded to you.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>EFA — EFOOTBALL FEDERAL ASSOCIATION</Text>
        <Text style={styles.footerText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

function AiGuidePage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader />

      {/* Submit a Result */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Using the EFA AI — Submit a Result</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>1. Send a screenshot.</Text> After your match, send a
              screenshot of the final score screen to the EFA AI.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>2. Choose the type.</Text> The AI replies with the score
              it read. Reply <Text style={styles.rowLabel}>1</Text> to submit a scheduled fixture,
              or <Text style={styles.rowLabel}>2</Text> to fix an already submitted fixture.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>3. Name the match.</Text> Type it as{' '}
              <Text style={styles.rowLabel}>"Team A vs Team B"</Text>, e.g. "Arsenal vs Everton".
              Short names work too ("psg vs arsenal").
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>4. Confirm.</Text> Reply <Text style={styles.rowLabel}>YES</Text>{' '}
              when the AI asks to confirm, then answer the forfeit question (did the losing team
              forfeit before the game finished?) with <Text style={styles.rowLabel}>yes</Text> or{' '}
              <Text style={styles.rowLabel}>no</Text>.
            </Text>
          </View>
          <View style={styles.rowLast}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>5. Done.</Text> The AI records your result and sends the
              standings link. Your opponent submits the same score and the AI confirms it.
            </Text>
          </View>
        </View>
      </View>

      {/* Reply Commands */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Reply Commands</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>SWAP</Text> — scores or stats are on the wrong side, the
              AI flips them.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>EDIT SCORE</Text> — override the score (aggregate or
              replay). Then type the new score, e.g. <Text style={styles.rowLabel}>3-2</Text>.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>check other date</Text> — if your fixture was on a
              different day. Then reply with the date, e.g. "12 Jul", "July 12" or "2026-07-12".
            </Text>
          </View>
          <View style={styles.rowLast}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>CANCEL</Text> — start over any time.
            </Text>
          </View>
        </View>
      </View>

      {/* Screenshot fallback */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>If the AI Can't Read the Screenshot</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.rowLast}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              If it replies <Text style={styles.warning}>"I couldn't analyse the image"</Text>, send
              the screenshot to the group instead. It may ask for team names, a date, or a number —
              just follow its prompts.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>EFA — EFOOTBALL FEDERAL ASSOCIATION</Text>
        <Text style={styles.footerText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

function BackdoorGuidePage() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader />

      {/* Backdoor funnel */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Backdoor — Opponent Not Responding</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              If your opponent isn't responding, don't lose the match for nothing. The backdoor is a{' '}
              <Text style={styles.rowLabel}>free win</Text> awarded to you. The backdoor window opens
              on <Text style={styles.rowLabel}>Thursday</Text>.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>1. Send "backdoor"</Text> to the EFA AI.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>2. Reply 1</Text> to submit a new backdoor, or{' '}
              <Text style={styles.rowLabel}>2</Text> to check your applications.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>3. Send a screenshot</Text> showing the opponent not
              responding.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>4. Type the fixture.</Text> e.g. "Arsenal vs Chelsea".
            </Text>
          </View>
          <View style={styles.rowLast}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              <Text style={styles.rowLabel}>5. Reply "home" or "away".</Text> Tell the AI which side
              you are. It records your application.
            </Text>
          </View>
        </View>
      </View>

      {/* Check applications */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Check Your Backdoor Applications</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.rowLast}>
            <View style={styles.bullet} />
            <Text style={styles.rowText}>
              Send <Text style={styles.rowLabel}>"backdoor"</Text> and reply{' '}
              <Text style={styles.rowLabel}>2</Text> any time to see the status of your applications
              (Pending, Approved, Declined or Void).
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>EFA — EFOOTBALL FEDERAL ASSOCIATION</Text>
        <Text style={styles.footerText}>PLAY • COMPETE • REPRESENT</Text>
      </View>
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Manager Onboarding Guide"
    author="Efootball Federal Association"
    subject="Manager onboarding guide"
  >
    <CoverPage />
    <RulesPage />
    <DropsPage />
    <InfoPage />
    <AiGuidePage />
    <BackdoorGuidePage />
  </Document>
)

async function main() {
  await renderToFile(doc, OUT)
  console.log('PDF written to', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
