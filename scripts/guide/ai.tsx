import React from 'react'
import { Document, Page } from '@react-pdf/renderer'
import { CoverPage, PageHeader, Footer, Section, Card, Row, CheckRow, Intro, Label, Warn, styles } from './shared'

const GUIDE_TITLE = 'EFA GUIDE — THE AI COACH (WHATSAPP)'

function MenuBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Start a Conversation with the EFA AI">
        <Card>
          <Intro>
            Message the EFA AI on WhatsApp and it replies with a simple numbered menu right away:
          </Intro>
          <CheckRow num="1">Send a match result</CheckRow>
          <CheckRow num="2">Opponent did not respond, or gave you the win</CheckRow>
          <CheckRow num="3">Create an EFA account</CheckRow>
          <CheckRow num="4">Check my backdoor applications</CheckRow>
          <CheckRow num="5" last>
            Tournament applications
          </CheckRow>
          <Row last>
            Just reply with the number of what you need. Mid-flow, every prompt shows{' '}
            <Label>1. Cancel / 2. Start again</Label>, and on match lists type{' '}
            <Label>CANCEL</Label> or <Label>START</Label>.
          </Row>
        </Card>
      </Section>

      <Section title="Create Your EFA Account">
        <Card>
          <Row>
            Reply <Label>3</Label> at the welcome menu. The bot asks for the username you want
            (letters, numbers and underscores only).
          </Row>
          <Row>
            If the number you're texting from already has an account, the bot tells you and sends the
            login link instead.
          </Row>
          <Row last>
            Done: the bot replies with your <Label>username, password and login link</Label>, plus the
            WhatsApp group invite. Your application stays valid for{' '}
            <Label>7 days</Label> while an admin assigns your team.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function SubmitBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Using the EFA AI — Submit a Result">
        <Card>
          <Row label="1. Send a screenshot.">
            Reply <Label>1</Label> at the welcome menu — or just send a screenshot of the final score
            screen to the EFA AI.
          </Row>
          <Row label="2. Choose what to do.">
            The AI shows the score it read (e.g. "Arsenal 3-2 Everton") and asks: reply{' '}
            <Label>1</Label> to submit this score for the first time, or <Label>2</Label> to change a
            score that was already submitted.
          </Row>
          <Row label="3. Name the match.">
            Type it as <Label>"Team A vs Team B"</Label>, e.g. "Arsenal vs Everton". Short names work
            too ("psg vs arsenal").
          </Row>
          <Row label="4. Pick the match.">
            If more than one match comes up, reply with the <Label>number</Label> of your match.
          </Row>
          <Row label="5. Confirm.">
            Reply <Label>YES</Label> when the AI asks to confirm, then answer the forfeit question
            (did the losing team forfeit before the game finished?) with <Label>yes</Label> or{' '}
            <Label>no</Label>.
          </Row>
          <Row label="6. Done." last>
            "Result submitted!" plus your standings link. Your opponent submits the same score and
            the AI confirms it.
          </Row>
        </Card>
      </Section>

      <Section title="Submission Window">
        <Card>
          <Row last>
            Results are accepted for matches due <Label>today or up to 7 days back</Label>. A result
            for a future fixture is saved and <Label>auto-confirmed on match day</Label>. Older
            matches must be submitted on the match day.
          </Row>
        </Card>
      </Section>

      <Section title="Reply Commands">
        <Card>
          <Row label="SWAP.">
            Scores or stats are on the wrong side — the AI flips them.
          </Row>
          <Row label="EDIT SCORE.">
            Override the score (aggregate or replay). Then type the new score, e.g.{' '}
            <Label>3-2</Label>.
          </Row>
          <Row label="check other date.">
            If your fixture was on a different day. Then reply with the date, e.g. "12 Jul", "July 12"
            or "2026-07-12".
          </Row>
          <Row label="fixtures / check fixtures / my fixtures.">
            See your fixtures for today and get your opponent's contact.
          </Row>
          <Row label="CANCEL.">
            (or the "1. Cancel / 2. Start again" hint on info prompts; CANCEL or START on match lists)
            — start over any time.
          </Row>
          <Row label="START." last>
            Back to the welcome menu.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function FixturesBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Check Your Fixtures">
        <Card>
          <Row>
            Send <Label>"check fixtures"</Label> (or just <Label>"fixtures"</Label> /{' '}
            <Label>"my fixtures"</Label>) to the EFA AI any time to see your fixtures for today.
          </Row>
          <Row>
            If your number is saved on your profile, the AI shows fixtures for{' '}
            <Label>all teams you manage</Label> in one list, split into Scheduled and Confirmed.
          </Row>
          <Row>
            Reply with a <Label>number</Label> to get your opponent's contact card, or type a{' '}
            <Label>date</Label> (e.g. "15 Aug") to check fixtures for another day.
          </Row>
          <Row last>
            If your number isn't on the system yet, the AI asks for your <Label>team name</Label> —
            reply with it. It may also offer to update the number you're texting from, so fixtures
            come straight to you next time.
          </Row>
        </Card>
      </Section>

      <Section title="If the AI Can't Read the Screenshot">
        <Card>
          <Row last>
            If it replies <Warn>"I couldn't analyse the image"</Warn>, send the screenshot again or
            describe the result. It may ask for team names, a date, or a number — just follow its
            prompts.
          </Row>
        </Card>
      </Section>

      <Section title="Tournament Applications">
        <Card>
          <Row>
            Reply <Label>5</Label> at the welcome menu to see open seasons with free (vacant) seats.
          </Row>
          <Row>
            Pick a season and the club you want to manage, then reply <Label>1</Label> to confirm.
          </Row>
          <Row last>
            Admins review your application and you get a <Label>WhatsApp notification</Label> when a
            decision is made.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function BackdoorBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Backdoor — Opponent Not Responding">
        <Card>
          <Row>
            If your opponent isn't responding, don't lose the match for nothing. The backdoor is a{' '}
            <Label>free win</Label> awarded to you.
          </Row>
          <Row label="1. Reply 2">
            at the welcome menu — or send <Label>"backdoor"</Label> — to the EFA AI.
          </Row>
          <Row label="2. Reply 1">
            to submit a new backdoor, or <Label>2</Label> to check your applications.
          </Row>
          <Row label="3. Send a screenshot">showing the opponent not responding.</Row>
          <Row label="4. Type the fixture.">e.g. "Arsenal vs Chelsea".</Row>
          <Row label="5. Reply 'home' or 'away'." last>
            Tell the AI which side you are. It records your application.
          </Row>
        </Card>
      </Section>

      <Section title="Check Your Backdoor Applications">
        <Card>
          <Row last>
            Send <Label>"backdoor"</Label> and reply <Label>2</Label> — or reply <Label>4</Label> at
            the welcome menu — any time to see the status of your applications (Pending, Approved,
            Declined or Void).
          </Row>
        </Card>
      </Section>

      <Section title="Backdoor Window">
        <Card>
          <Row last>
            The window opens on <Label>Thursday</Label> and submissions expire on Tuesday. See the{' '}
            <Label>deadlines guide</Label> for the full schedule of windows.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Manager — AI Guide"
    author="Efootball Federal Association"
    subject="EFA WhatsApp AI guide"
  >
    <CoverPage title="EFA MANAGER" subtitle="AI GUIDE" tagline="Efootball Federal Association" />
    <MenuBody />
    <SubmitBody />
    <FixturesBody />
    <BackdoorBody />
  </Document>
)

export default doc