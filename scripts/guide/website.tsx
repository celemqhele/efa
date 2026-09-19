import React from 'react'
import { Document, Page } from '@react-pdf/renderer'
import { CoverPage, PageHeader, Footer, Section, Card, Row, Label, Warn, styles } from './shared'

const GUIDE_TITLE = 'EFA GUIDE — THE WEBSITE'

function AccountBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Your Account">
        <Card>
          <Row>
            Create your account on the <Label>Register</Label> page (username + password) or reply{' '}
            <Label>3</Label> to the EFA AI on WhatsApp. Your username is your identity in the EFA.
          </Row>
          <Row>
            Your number and details are shared across the site and WhatsApp — fixtures follow the
            number you registered with.
          </Row>
          <Row label="Forgot your password?" last>
            Ask the EFA AI to reset it.
          </Row>
        </Card>
      </Section>

      <Section title="Logging In">
        <Card>
          <Row>
            Sign in with your <Label>username and password</Label>. Browsing fixtures, results and
            standings works without an account.
          </Row>
          <Row last>
            You need to be logged in for your own fixtures, your manager profile, notifications, polls
            and profile settings.
          </Row>
        </Card>
      </Section>

      <Section title="Finding Your Way Around">
        <Card>
          <Row>
            <Label>Desktop:</Label> a bar across the bottom of the screen — Home / Fixtures / Results /
            Standings.
          </Row>
          <Row>
            <Label>Mobile:</Label> Home / Fixtures / Results tabs at the bottom, plus the{' '}
            <Label>More</Label> menu for Hall of Fame, Rules, Profile, Notifications and Log in/Log out.
          </Row>
          <Row>
            Pages like Standings, Calendar, Teams and Polls are linked through the Home page cards and
            the More menu.
          </Row>
          <Row last>
            The <Label>bell icon</Label> (top right) opens your notifications.
          </Row>
        </Card>
      </Section>

      <Section title="Your Home Page">
        <Card>
          <Row>
            Your upcoming fixtures for today, your latest results, a snapshot of the top of the table
            and a quick link to the calendar.
          </Row>
          <Row last>
            The <Label>View Standings</Label> and <Label>Fixtures</Label> buttons jump straight to
            those pages.
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

      <Section title="Fixtures">
        <Card>
          <Row>
            <Label>My Fixtures</Label> lists the matches for the teams you manage, grouped by date
            with Today / Tomorrow labels.
          </Row>
          <Row>
            Each row shows the competition tag (<Label>PL</Label> / <Label>UCL</Label> /{' '}
            <Label>EL</Label> / <Label>SC</Label>), the matchday, your opponent and the match state
            (Scheduled / Awaiting / Full Time).
          </Row>
          <Row last>
            Open a fixture to see the score, who is home and away, the {''}
            <Label>matchroom code</Label> + who creates it, the submit-score options, a Banter Board
            and the disconnect rules.
          </Row>
        </Card>
      </Section>

      <Section title="Playing the Match">
        <Card>
          <Row label="Matchroom.">
            The home team creates the matchroom with the fixture's matchroom code. The away team joins
            it. The site shows exactly which side you are.
          </Row>
          <Row label="Coach's analysis.">
            When you open your own fixture you'll also see a suggested game plan — confidence, what to
            exploit and a recommendation.
          </Row>
          <Row label="Waiting reports.">
            If your opponent doesn't show, the site will show a Waiting Reports notice. Tie in with
            the <Label>deadlines guide</Label> for the exact window.
          </Row>
          <Row last>
            Finished matches show full-time score plus a match screenshot and live match statistics.
          </Row>
        </Card>
      </Section>

      <Section title="Submitting Results">
        <Card>
          <Row>
            Submit your result by sending a <Label>screenshot to the EFA AI on WhatsApp</Label> — or
            from the fixture page.
          </Row>
          <Row last>
            Your opponent submits the same score and the result is confirmed automatically.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function ResultsStandingsBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Results">
        <Card>
          <Row>
            <Label>My Results</Label> shows your win / draw / loss summary and every result,
            colour-coded by outcome.
          </Row>
          <Row last>
            Open a result to see the full-time score, the match statistics (possession, shots, passes
            and more) and the match screenshot.
          </Row>
        </Card>
      </Section>

      <Section title="Standings">
        <Card>
          <Row>
            Pick the <Label>Competition</Label> with the dropdown (or the switcher on mobile) — every
            active league and cup appears there.
          </Row>
          <Row>
            League mode shows <Label># / Team / P / W / D / L / A / GD / PTS</Label>; group stages
            show each group's own table with the teams that qualify marked.
          </Row>
          <Row>
            The <Label>top 3</Label> are highlighted in gold, and coloured zones follow each
            competition's rules.
          </Row>
          <Row last>
            Click any team to open its page.
          </Row>
        </Card>
      </Section>

      <Section title="Teams &amp; Managers">
        <Card>
          <Row>
            Every team has a page: logo, manager, playstyle DNA, recent fixtures and results, season
            stats, their head-to-head record and trophy cabinet.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function ManagersBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Finding the Managers in the EFA">
        <Card>
          <Row>
            There isn't one single "managers list" page — every fixture and team links to the
            managers, so you're always one tap away from the person you need.
          </Row>
          <Row label="From any match.">
            Tap your opponent's name on a fixture to open their manager profile and send them a
            WhatsApp message.
          </Row>
          <Row label="From a team page.">
            Each team shows "vs @manager" with a Message button that opens WhatsApp using the
            manager's saved number.
          </Row>
          <Row label="From the calendar.">
            The calendar shows who plays whom each day — click through to the fixture and from there
            to the manager.
          </Row>
          <Row label="From a manager profile." last>
            /managers/{'{'}name{'}'} shows career stats (P / W / D / L, win rate), their clubs, and
            management history — a single place to see who manages what.
          </Row>
        </Card>
      </Section>

      <Section title="Updating Your Contact Number">
        <Card>
          <Row last>
            Manager contact cards are powered by the phone number on your profile. Keep it updated on
            the website (or tell the EFA AI) so opponents can always reach you.
          </Row>
        </Card>
      </Section>

      <Section title="Birth of a Fixture Week">
        <Card>
          <Row>
            Fixtures are released by the admins, then you coordinate a time with your opponent via the
            matchroom code on the fixture page. See the <Label>deadlines guide</Label> for when each
            match is due.
          </Row>
          <Row last>
            Results come from both clubs submitting the same score — automatic, no admin needed.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function CalendarPollsBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Calendar">
        <Card>
          <Row>
            A month view of every match, with the score shown for days that are finished.
          </Row>
          <Row last>
            Scope it to <Label>my</Label> fixtures or <Label>all</Label> fixtures, and browse months
            with the arrows.
          </Row>
        </Card>
      </Section>

      <Section title="Polls">
        <Card>
          <Row>
            Open polls list tournaments with vacant (open) seats — usually near season start.
          </Row>
          <Row last>
            Apply for the team you want from the poll page, or withdraw your application before it
            closes. Admin decisions come through as notifications.
          </Row>
        </Card>
      </Section>

      <Section title="Hall of Fame &amp; Rules">
        <Card>
          <Row label="Hall of Fame.">
            Official records — most trophies, most league titles and a full per-season archive of
            winners.
          </Row>
          <Row label="Rules." last>
            The official EFA Rule Book: match rules, abandonment rules, the disconnect table, the
            anti-forfeit rule and matchroom instructions.
          </Row>
        </Card>
      </Section>

      <Section title="Notifications">
        <Card>
          <Row last>
            The bell collects reminders — fixtures due today, results confirmed, backdoor decisions,
            and updates on your applications.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function ProfileBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="Your Profile &amp; Settings">
        <Card>
          <Row label="Profile picture.">
            Change it right from your profile — upload a photo, crop it, save.
          </Row>
          <Row label="Phone number.">
            Edit it on the site (country code + number) — your contact card updates everywhere.
          </Row>
          <Row label="Theme.">
            Personalise the look: pick a preset or upload a custom background image.
          </Row>
          <Row label="Change password.">
            In profile, under Security — enter your current password first.
          </Row>
          <Row label="Apply to a season." last>
            See open tournaments with vacant seats and apply straight from your profile.
          </Row>
        </Card>
      </Section>

      <Section title="Your Number &amp; WhatsApp">
        <Card>
          <Row last>
            The bot links everything to the phone number you text from. If it ever changes, update it
            on the website or ask the EFA AI to sync it — your fixtures follow the new number.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

function TournamentsBody() {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader title={GUIDE_TITLE} />

      <Section title="How Tournaments &amp; Leagues Work">
        <Card>
          <Row>
            The EFA runs several competitions inside one season (e.g. 2025/26). Your club — and
            sometimes more than one club — is entered into several at once: a league plus cups.
          </Row>
          <Row last>
            Every match carries a competition tag (<Label>PL</Label> / <Label>UCL</Label> /{' '}
            <Label>EL</Label> / <Label>SC</Label>) so you always know what you're playing for.
          </Row>
        </Card>
      </Section>

      <Section title="Leagues (Premier League)">
        <Card>
          <Row>
            A <Label>round-robin</Label>: every club plays every other club home and away.
          </Row>
          <Row last>
            The league table on the Standings page decides the order — points first, then goal
            difference.
          </Row>
        </Card>
      </Section>

      <Section title="Knockout Cups (UCL, Europa)">
        <Card>
          <Row>
            Clubs are drawn into <Label>groups</Label> that play a mini round-robin; the top
            qualifiers advance to the knockouts.
          </Row>
          <Row>
            Knockout ties are <Label>two-legged</Label> — the aggregate score over both legs decides
            the winner.
          </Row>
          <Row last>
            If aggregate and away goals stay level, the tie goes to penalties.
          </Row>
        </Card>
      </Section>

      <Section title="Other Competitions">
        <Card>
          <Row label="Super Cup.">
            A single final between the season's top winners.
          </Row>
          <Row label="Friendlies.">Optional matches used to fill free dates.</Row>
          <Row label="Vacant seats." last>
            If a club has no manager, it <Warn>auto-forfeits 0-3</Warn> until a manager joins through
            an application (Polls / apply on profile) or admin assignment.
          </Row>
        </Card>
      </Section>

      <Footer />
    </Page>
  )
}

const doc = (
  <Document
    title="EFA Manager — Website Guide"
    author="Efootball Federal Association"
    subject="EFA website UI and tournaments guide"
  >
    <CoverPage title="EFA MANAGER" subtitle="WEBSITE GUIDE" tagline="Efootball Federal Association" />
    <AccountBody />
    <FixturesBody />
    <ResultsStandingsBody />
    <ManagersBody />
    <CalendarPollsBody />
    <ProfileBody />
    <TournamentsBody />
  </Document>
)

export default doc