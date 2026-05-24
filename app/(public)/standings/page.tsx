import { createClient } from "@/lib/supabase/server";
import TeamLogo from "@/components/ui/TeamLogo";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tournament?: string }>;
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: "PL",
  ucl: "UCL",
  europa: "Europa",
  super_cup: "Super Cup",
};

function goalDifference(row: any): number {
  return (row.goals_for ?? 0) - (row.goals_against ?? 0);
}

function sortStandingsRows(rows: any[]) {
  return [...rows].sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0))
      return (b.points ?? 0) - (a.points ?? 0);

    const gdA = goalDifference(a);
    const gdB = goalDifference(b);
    if (gdB !== gdA) return gdB - gdA;

    if ((b.goals_for ?? 0) !== (a.goals_for ?? 0))
      return (b.goals_for ?? 0) - (a.goals_for ?? 0);

    return String(a.team?.name ?? "").localeCompare(String(b.team?.name ?? ""));
  });
}

function formatGroupTitle(groupName: string) {
  const clean = String(groupName ?? "").trim();
  if (!clean) return "Group A";
  return /^group\s+/i.test(clean) ? clean : `Group ${clean}`;
}

function StandingsTable({
  rows,
  mode,
}: {
  rows: any[];
  mode: "league" | "group";
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[34px_1fr_32px_32px_32px_32px_42px_44px] items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center text-[#c9a84c]">Pts</span>
      </div>

      {rows.map((row: any, index: number) => {
        const gd = goalDifference(row);
        const qualificationBorder =
          mode === "league"
            ? index < 12
              ? "border-l-[#c9a84c]"
              : index < 20
                ? "border-l-blue-500"
                : "border-l-transparent"
            : index < 2
              ? "border-l-[#c9a84c]"
              : "border-l-transparent";

        const teamHref = row.team_id ? `/teams/${row.team_id}` : null;
        const rowClassName = `grid grid-cols-[34px_1fr_32px_32px_32px_32px_42px_44px] items-center gap-2 px-3 py-2 text-xs border-l-4 ${qualificationBorder} ${index % 2 === 0 ? "bg-slate-50" : "bg-white"} ${teamHref ? "hover:bg-[#c9a84c]/10 transition-colors cursor-pointer" : ""}`;
        const rowContent = (
          <>
            <span className="text-center font-bold text-slate-500">
              {index + 1}
            </span>

            <div className="flex items-center gap-2 min-w-0">
              {row.team?.logo_league_folder && (
                <TeamLogo
                  leagueFolder={row.team.logo_league_folder}
                  teamSlug={row.team.logo_team_slug}
                  context="standings_row"
                  alt={row.team.name}
                  className="w-7 h-7 shrink-0"
                />
              )}
              <span className="font-semibold text-slate-900 truncate">
                {row.team?.name ?? "Unknown team"}
              </span>
              {mode === "group" && index < 2 && (
                <span className="text-[9px] font-black text-[#c9a84c] border border-[#c9a84c]/30 rounded px-1 py-0.5">
                  Q
                </span>
              )}
            </div>

            <span className="text-center text-slate-600">
              {row.played ?? 0}
            </span>
            <span className="text-center text-slate-600">{row.wins ?? 0}</span>
            <span className="text-center text-slate-600">{row.draws ?? 0}</span>
            <span className="text-center text-slate-600">
              {row.losses ?? 0}
            </span>
            <span
              className={`text-center font-semibold ${gd >= 0 ? "text-green-600" : "text-red-500"}`}
            >
              {gd > 0 ? `+${gd}` : gd}
            </span>
            <span className="text-center font-black text-[#c9a84c]">
              {row.points ?? 0}
            </span>
          </>
        );

        return teamHref ? (
          <Link
            key={row.id ?? `${row.team_id}-${index}`}
            href={teamHref}
            className={rowClassName}
          >
            {rowContent}
          </Link>
        ) : (
          <div
            key={row.id ?? `${row.team_id}-${index}`}
            className={rowClassName}
          >
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}

export default async function StandingsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const selectedTournamentId = params.tournament ?? null;

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, type, status")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const requestedTournament = selectedTournamentId
    ? tournaments?.find((t) => t.id === selectedTournamentId)
    : null;

  const activeTournamentId =
    requestedTournament?.id ?? tournaments?.[0]?.id ?? null;
  const activeTournament = tournaments?.find(
    (t) => t.id === activeTournamentId,
  );

  const isLeagueTournament = activeTournament?.type === "league";
  const isGroupTournament =
    activeTournament?.type === "ucl" || activeTournament?.type === "europa";

  let leagueStandings: any[] = [];
  const groupStandings: Record<string, any[]> = {};

  if (activeTournamentId && isLeagueTournament) {
    const { data } = await supabase
      .from("standings")
      .select("*, team:teams(id, name, logo_league_folder, logo_team_slug)")
      .eq("tournament_id", activeTournamentId);

    leagueStandings = sortStandingsRows(data ?? []);
  }

  if (activeTournamentId && isGroupTournament) {
    const { data } = await supabase
      .from("group_standings")
      .select("*, team:teams(id, name, logo_league_folder, logo_team_slug)")
      .eq("tournament_id", activeTournamentId);

    const rows = data ?? [];
    for (const row of rows) {
      const groupName = row.group_name ?? "A";
      if (!groupStandings[groupName]) groupStandings[groupName] = [];
      groupStandings[groupName].push(row);
    }

    for (const groupName of Object.keys(groupStandings)) {
      groupStandings[groupName] = sortStandingsRows(groupStandings[groupName]);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Standings</h1>
        {activeTournament && (
          <p className="text-sm text-[#c9a84c] mt-0.5">
            {activeTournament.name}
          </p>
        )}
      </div>

      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => {
            const isActive = t.id === activeTournamentId;
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  isActive
                    ? "bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]"
                    : "bg-transparent text-slate-400 border-slate-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]"
                }`}
              >
                {TOURNAMENT_TYPE_LABELS[t.type] ?? t.name}
              </Link>
            );
          })}
        </div>
      )}

      {!activeTournamentId ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No active tournaments.</p>
        </div>
      ) : isLeagueTournament ? (
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                League Standings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data comes from the recalculated standings table.
              </p>
            </div>
          </div>

          {leagueStandings.length > 0 ? (
            <>
              <StandingsTable rows={leagueStandings} mode="league" />
              <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#c9a84c]" />
                  UCL places
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  Europa places
                </span>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No standings data yet. Use the admin refresh standings button for
              this tournament.
            </div>
          )}
        </div>
      ) : isGroupTournament ? (
        <div className="card p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Group Standings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Data comes from the recalculated group_standings table.
            </p>
          </div>

          {Object.keys(groupStandings).length > 0 ? (
            <>
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#c9a84c]">
                      {formatGroupTitle(groupName)}
                    </h3>
                    <StandingsTable rows={rows} mode="group" />
                  </div>
                ))}

              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#c9a84c]" />
                Top 2 qualify
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No group standings data yet. Use the admin refresh standings
              button for this tournament.
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">
            No standings available for this tournament type.
          </p>
        </div>
      )}
    </div>
  );
}
