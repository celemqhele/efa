import HallOfFameAdmin from './HallOfFameAdmin'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground-primary">Hall of Fame</h1>
        <p className="text-text-muted text-sm mt-1">
          Manually award or remove trophies for any season.
        </p>
      </div>

      <HallOfFameAdmin
        teams={data.teams}
        seasons={data.seasons}
        tournaments={data.tournaments}
        trophies={data.trophies}
      />
    </div>
  )
}
