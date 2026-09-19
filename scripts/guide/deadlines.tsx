import React from 'react'
import { Document, Page } from '@react-pdf/renderer'
import { CoverPage, PageHeader, Footer, Section, Card, Row, Label, Warn, styles } from './shared'

const GUIDE_TITLE = 'EFA GUIDE — DEADLINES'

function DeadlinesBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="When Fixtures Come Out">
        <Card>
          <Row>
            Fixtures are released by the admins. When a tournament's fixtures go live, every match
            gets its own date rather than a fixed weekly slot.
          </Row>
          <Row>
            Matches are spread across consecutive days (up to 8 per day per tournament, and{' '}
            <Label>max 1 match per team per day</Label>), so check your fixtures every day.
          </Row>
          <Row label="Daily reminders." last>
            You'll get a WhatsApp reminder for the matches due today. You can also ask the AI — "check
            fixtures" — or open your fixtures page on the website.
          </Row>
        </Card>
      </Section>

      <Section title="Match Deadline">
        <Card>
          <Row>
            Every fixture must be completed by <Label>14:00 SAST</Label> on its own date.
          </Row>
          <Row>
            There is <Label>no weekly "Sunday" deadline</Label> anymore — each match is due on its own
            day.
          </Row>
          <Row>
            Play and submit your result <Warn>before the deadline</Warn> to avoid a walkover.
          </Row>
        </Card>
      </Section>

      <Section title="Opponent Not Showing Up">
        <Card>
          <Row>
            On match day the <Label>Report Waiting</Label> option is available from{' '}
            <Label>13:00 to 14:05 SAST</Label>. Only use it if your opponent hasn't shown up for the
            fixture. (See the Rules page.)
          </Row>
          <Row>
            At <Label>14:05 SAST</Label> the EFA settles it automatically: if only one side reported,
            that side gets the <Label>3-0 win</Label> and the other side gets the auto-loss.
          </Row>
          <Row last>
            If <Warn>neither team</Warn> reports, the fixture is recorded as a{' '}
            <Warn>0-0 draw with no points</Warn>. Repeat offenders face a hearing with the admins.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function WindowBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Backdoor Window">
        <Card>
          <Row>
            If your opponent isn't responding, you can claim a <Label>backdoor (free win)</Label>. The
            backdoor window opens on <Label>Thursday</Label>.
          </Row>
          <Row>
            Submissions expire on <Label>Tuesday</Label> — after that they can no longer be processed.
          </Row>
          <Row label="How to apply." last>
            Reply <Label>2</Label> at the EFA AI's menu — or send "backdoor" — and follow its steps.
            Admins approve or decline it with a WhatsApp notification.
          </Row>
        </Card>
      </Section>

      <Section title="Submitting Results">
        <Card>
          <Row>
            Results are accepted for matches due <Label>today or up to 7 days back</Label>.
          </Row>
          <Row>
            A result for a <Label>future</Label> match is saved and{' '}
            <Label>auto-confirmed at 00:00 on match day</Label>.
          </Row>
          <Row last>
            Matches older than 7 days can't be submitted here — send the screenshot on the match day.
          </Row>
        </Card>
      </Section>

      <Section title="Forfeits &amp; No-Shows">
        <Card>
          <Row>
            A forfeit means a loss for the forfeiting side — the winning side gets the win with a{' '}
            <Label>+3 score adjustment</Label>.
          </Row>
          <Row>
            Season-end: the forfeiting team takes a <Label>-3 goal difference penalty</Label>, and the
            forfeit score carries over to the next meeting between the same two teams.
          </Row>
          <Row last>
            A club with no manager (a vacant seat) <Warn>auto-forfeits 0-3</Warn> each round; two
            vacant clubs get a 0-0.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Manager — Deadlines"
    author="Efootball Federal Association"
    subject="EFA fixture deadlines guide"
  >
    <CoverPage title="EFA MANAGER" subtitle="DEADLINES" tagline="Efootball Federal Association" />
    <DeadlinesBody />
    <WindowBody />
  </Document>
)

export default doc