'use client'
import ResultSubmitClient from './ResultSubmitClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground-primary">Submit Result</h1>
        <p className="text-text-muted text-sm mt-1">
          Finalise fixture results via screenshot OCR or manual entry.
        </p>
      </div>
      <ResultSubmitClient
        pendingFixtures={data.pendingFixtures}
        confirmationsByFixture={data.confirmationsByFixture}
        teamNameMappings={data.teamNameMappings}
        allTeams={data.allTeams}
        defaultFixtureId={data.defaultFixtureId}
      />
    </div>
  )
}
