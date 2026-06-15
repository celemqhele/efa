import HallOfFameAdmin from './HallOfFameAdmin'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-3 pb-6 space-y-4">
      <h1 className="text-lg font-bold text-text-primary">Hall of Fame</h1>
      <p className="text-xs text-text-muted">Manually award or remove trophies for any season.</p>
      <HallOfFameAdmin
        teams={data.teams}
        seasons={data.seasons}
        tournaments={data.tournaments}
        trophies={data.trophies}
      />
    </div>
  )
}
