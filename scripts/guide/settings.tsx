import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { CoverPage, PageHeader, Footer, Section, Card, Row, CheckRow, Intro, Label, Warn, styles } from './shared'

const GUIDE_TITLE = 'EFA GUIDE — GAME SETTINGS'

function SettingsBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Welcome">
        <Card>
          <Intro>
            Welcome, Manager! You are in control of your club in the{' '}
            <Label>Efootball Federal Association (EFA)</Label>. Each fixture is set up with the exact
            match settings below — agree on them before kick-off so every match is played fairly.
          </Intro>
        </Card>
      </Section>

      <Section title="Match Settings">
        <Card>
          <CheckRow num="✓">
            <Label>Match time:</Label> 10 minutes
          </CheckRow>
          <CheckRow num="✓">
            <Label>Stadium:</Label> Any (neutral preferred)
          </CheckRow>
          <CheckRow num="✓">
            <Label>Injuries:</Label> OFF
          </CheckRow>
          <CheckRow num="✓">
            <Label>Substitutions:</Label> 6 subs for both teams
          </CheckRow>
          <CheckRow num="✓">
            <Label>Conditions:</Label> Excellent for both players
          </CheckRow>
          <CheckRow num="✓" last>
            <Label>Kit:</Label> Always use your team's logo
          </CheckRow>
        </Card>
      </Section>

      <Section title="Gameplay Rules">
        <Card>
          <Row label="No Smart Assist.">Smart Assist is NOT allowed in any match.</Row>
          <Row label="No cheating.">No exploits, glitches, or unfair tactics.</Row>
          <Row label="No quitting.">
            Quitting mid-match <Warn>counts as a loss</Warn>.
          </Row>
          <Row label="Connection drop." last>
            If the network interrupts play, the match is <Label>replayed</Label> from the point shown
            on the next page. If a player refuses to replay, it{' '}
            <Warn>counts as a loss</Warn> for the player who doesn't replay.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function DropsBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Playing Your Match">
        <Card>
          <Row label="1. Message your opponent.">
            Contact them on WhatsApp to arrange your match ("you have a match"). You'll see their
            manager name on your fixture.
          </Row>
          <Row label="2. Create the matchroom.">
            If you're the <Label>home team</Label>, you create the matchroom and set up the match
            settings above. The away team joins your room.
          </Row>
          <Row label="3. Kick off." last>
            Use the exact match settings listed on the previous page, and confirm the correct
            settings before you start.
          </Row>
        </Card>
      </Section>

      <Section title="If the Connection Drops">
        <Card>
          <Row last>
            Find the minute the match was interrupted, then restart with the match time shown below.{' '}
            <Label>Aggregate (agg) carries on</Label> — played minutes are not replayed.
          </Row>
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
              const RowEl = last ? styles.tableRowLast : styles.tableRow
              return (
                <View key={i} style={RowEl}>
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
            If the players cannot agree on the disconnect minute, replay from the start of the
            match.
          </Text>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Manager — Game Settings"
    author="Efootball Federal Association"
    subject="EFA game settings and rules guide"
  >
    <CoverPage title="EFA MANAGER" subtitle="GAME SETTINGS" tagline="Efootball Federal Association" />
    <SettingsBody />
    <DropsBody />
  </Document>
)

export default doc