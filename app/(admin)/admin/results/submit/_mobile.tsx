'use client'
import ResultSubmitClient from './ResultSubmitClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Submit Result</h1>
          <p className="text-text-muted text-xs mt-0.5">
            Finalise fixture results via screenshot OCR or manual entry.
          </p>
        </div>
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
