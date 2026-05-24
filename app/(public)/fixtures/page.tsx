import { createClient } from "@/lib/supabase/server";
import TeamLogo from "@/components/ui/TeamLogo";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tournament?: string; matchday?: string }>;
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: "PL",
  ucl: "UCL",
  europa: "Europa",
  super_cup: "Super Cup",
};

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: {
    label: "Scheduled",
    pill: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
  awaiting_confirmation: {
    label: "Awaiting",
    pill: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  confirmed: {
    label: "FT",
    pill: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  abandoned: {
    label: "Abandoned",
    pill: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

const ROUND_LABELS: Record<string, string> = {
  sf: "Semi-Final",
  final: "Final",
};

const APP_TIME_ZONE = "Africa/Johannesburg";

function getDateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getDateKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return getDateKeyFromDate(date);
}

async function getSupabaseTodayKey(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("get_app_time");

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.today_local) return String(row.today_local);
  }

  // Fallback only if the Supabase RPC has not been created yet.
  return getDateKeyFromDate(new Date());
}

export default async function FixturesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const selectedTournamentId = params.tournament ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  // Only fetch active tournaments
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

  // Build matchday completion map
  const { data: allMdRows } = activeTournamentId
    ? await supabase
        .from("fixtures")
        .select("matchday, scheduled_date, status")
        .eq("tournament_id", activeTournamentId)
    : { data: null };

  const mdMap: Record<number, { total: number; done: number }> = {};
  const mdDates: Record<number, string[]> = {};

  for (const f of allMdRows ?? []) {
    const md = f.matchday ?? 0;
    const dateKey = getDateKey(f.scheduled_date);

    if (!md) continue;
    if (!mdMap[md]) mdMap[md] = { total: 0, done: 0 };
    if (!mdDates[md]) mdDates[md] = [];

    mdMap[md].total++;
    if (f.status === "confirmed") mdMap[md].done++;
    if (dateKey && !mdDates[md].includes(dateKey)) mdDates[md].push(dateKey);
  }

  const sortedMatchdays = Object.keys(mdMap)
    .map(Number)
    .sort((a, b) => a - b);
  const todayKey = await getSupabaseTodayKey(supabase);

  // A single calendar day can contain multiple matchdays.
  // Default load = the FIRST matchday scheduled for today.
  // Badge logic below marks ALL matchdays scheduled today as Current.
  const todayMatchdays = sortedMatchdays.filter((md) =>
    mdDates[md]?.includes(todayKey),
  );

  const nextUpcomingMatchday =
    sortedMatchdays
      .map((md) => ({
        md,
        dateKey:
          (mdDates[md] ?? []).filter((date) => date >= todayKey).sort()[0] ??
          null,
      }))
      .filter(
        (item) => item.dateKey && mdMap[item.md]?.done < mdMap[item.md]?.total,
      )
      .sort(
        (a, b) =>
          String(a.dateKey).localeCompare(String(b.dateKey)) || a.md - b.md,
      )[0]?.md ?? null;

  const firstIncompleteMatchday =
    sortedMatchdays.find((md) => mdMap[md].done < mdMap[md].total) ?? null;

  const currentMatchday =
    todayMatchdays[0] ??
    nextUpcomingMatchday ??
    firstIncompleteMatchday ??
    sortedMatchdays[sortedMatchdays.length - 1] ??
    1;

  const selectedMatchday = params.matchday
    ? parseInt(params.matchday)
    : currentMatchday;

  // Fetch ALL fixtures for the selected matchday (no status filter)
  const { data: fixtures } = activeTournamentId
    ? await supabase
        .from("fixtures")
        .select(
          `
          id, matchday, scheduled_date, status, round_type, leg,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
        `,
        )
        .eq("tournament_id", activeTournamentId)
        .eq("matchday", selectedMatchday)
        .order("scheduled_date", { ascending: true })
    : { data: null };

  // Fetch results separately — PostgREST join on results is unreliable without
  // explicit FK hint, so we query directly and merge by fixture_id.
  const fixtureIds = (fixtures ?? []).map((f: any) => f.id);
  const { data: resultsData } =
    fixtureIds.length > 0
      ? await supabase
          .from("results")
          .select("fixture_id, home_score, away_score")
          .in("fixture_id", fixtureIds)
      : { data: [] };

  const resultsByFixture: Record<
    string,
    { home_score: number; away_score: number }
  > = {};
  for (const r of resultsData ?? []) {
    resultsByFixture[r.fixture_id] = r;
  }

  const isLeagueTournament = activeTournament?.type === "league";
  const isGroupTournament =
    activeTournament?.type === "ucl" || activeTournament?.type === "europa";

  // Build public standings from tournament_participants first.
  // This is important for UCL/Europa because teams with 0 games played must still appear.
  const { data: participantRows } =
    activeTournamentId && (isLeagueTournament || isGroupTournament)
      ? await supabase
          .from("tournament_participants")
          .select("team_id, group_name")
          .eq("tournament_id", activeTournamentId)
      : { data: [] };

  const participantTeamIds = Array.from(
    new Set((participantRows ?? []).map((p: any) => p.team_id).filter(Boolean)),
  );

  const { data: participantTeams } =
    participantTeamIds.length > 0
      ? await supabase
          .from("teams")
          .select("id, name, logo_league_folder, logo_team_slug")
          .in("id", participantTeamIds)
      : { data: [] };

  const teamById: Record<string, any> = {};
  for (const team of participantTeams ?? []) {
    teamById[(team as any).id] = team;
  }

  const participantGroupByTeam: Record<string, string> = {};
  for (const p of participantRows ?? []) {
    if (!(p as any).team_id) continue;
    participantGroupByTeam[(p as any).team_id] = (p as any).group_name ?? "A";
  }

  const { data: standingsFixtures } =
    activeTournamentId && (isLeagueTournament || isGroupTournament)
      ? await supabase
          .from("fixtures")
          .select("id, home_team_id, away_team_id, round_type")
          .eq("tournament_id", activeTournamentId)
          .eq("status", "confirmed")
      : { data: [] };

  const standingsFixtureIds = (standingsFixtures ?? []).map((f: any) => f.id);

  const { data: standingsResultRows } =
    standingsFixtureIds.length > 0
      ? await supabase
          .from("results")
          .select("fixture_id, home_score, away_score, override_reason")
          .in("fixture_id", standingsFixtureIds)
      : { data: [] };

  const standingsResultsByFixture: Record<
    string,
    { home_score: number; away_score: number; override_reason?: string | null }
  > = {};
  for (const r of standingsResultRows ?? []) {
    standingsResultsByFixture[(r as any).fixture_id] = {
      home_score: (r as any).home_score,
      away_score: (r as any).away_score,
      override_reason: (r as any).override_reason,
    };
  }

  const createStandingRow = (teamId: string, groupName?: string | null) => ({
    id: groupName ? `${groupName}-${teamId}` : teamId,
    team_id: teamId,
    group_name: groupName ?? null,
    team: teamById[teamId] ?? null,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
  });

  const applyResultToRows = (
    homeRow: any,
    awayRow: any,
    homeScore: number,
    awayScore: number,
  ) => {
    const homeWin = homeScore > awayScore;
    const awayWin = awayScore > homeScore;
    const draw = homeScore === awayScore;

    homeRow.played++;
    awayRow.played++;

    homeRow.wins += homeWin ? 1 : 0;
    homeRow.draws += draw ? 1 : 0;
    homeRow.losses += awayWin ? 1 : 0;
    homeRow.goals_for += homeScore;
    homeRow.goals_against += awayScore;
    homeRow.points += homeWin ? 3 : draw ? 1 : 0;

    awayRow.wins += awayWin ? 1 : 0;
    awayRow.draws += draw ? 1 : 0;
    awayRow.losses += homeWin ? 1 : 0;
    awayRow.goals_for += awayScore;
    awayRow.goals_against += homeScore;
    awayRow.points += awayWin ? 3 : draw ? 1 : 0;
  };

  const sortStandingRows = (rows: any[]) =>
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      const gdA = (a.goals_for ?? 0) - (a.goals_against ?? 0);
      const gdB = (b.goals_for ?? 0) - (b.goals_against ?? 0);
      if (gdB !== gdA) return gdB - gdA;

      if ((b.goals_for ?? 0) !== (a.goals_for ?? 0))
        return (b.goals_for ?? 0) - (a.goals_for ?? 0);

      return String(a.team?.name ?? "").localeCompare(
        String(b.team?.name ?? ""),
      );
    });

  let leagueStandings: any[] = [];
  const groupStandings: Record<string, any[]> = {};

  if (isLeagueTournament) {
    const leagueMap: Record<string, any> = {};

    for (const p of participantRows ?? []) {
      const teamId = (p as any).team_id;
      if (!teamId) continue;
      leagueMap[teamId] = createStandingRow(teamId);
    }

    for (const f of standingsFixtures ?? []) {
      const fixture = f as any;
      if (fixture.round_type && fixture.round_type !== "league") continue;

      const result = standingsResultsByFixture[fixture.id];
      if (!result) continue;

      const reason = (result.override_reason ?? "").toLowerCase();
      if (reason.includes("both") && reason.includes("absent")) continue;

      const homeRow = leagueMap[fixture.home_team_id];
      const awayRow = leagueMap[fixture.away_team_id];
      if (!homeRow || !awayRow) continue;

      applyResultToRows(homeRow, awayRow, result.home_score, result.away_score);
    }

    leagueStandings = sortStandingRows(Object.values(leagueMap));
  }

  if (isGroupTournament) {
    const groupMap: Record<string, Record<string, any>> = {};

    for (const p of participantRows ?? []) {
      const teamId = (p as any).team_id;
      if (!teamId) continue;

      const groupName = (p as any).group_name ?? "A";
      if (!groupMap[groupName]) groupMap[groupName] = {};
      groupMap[groupName][teamId] = createStandingRow(teamId, groupName);
    }

    for (const f of standingsFixtures ?? []) {
      const fixture = f as any;
      if (fixture.round_type !== "group") continue;

      const result = standingsResultsByFixture[fixture.id];
      if (!result) continue;

      const reason = (result.override_reason ?? "").toLowerCase();
      if (reason.includes("both") && reason.includes("absent")) continue;

      const homeGroup = participantGroupByTeam[fixture.home_team_id] ?? "A";
      const awayGroup =
        participantGroupByTeam[fixture.away_team_id] ?? homeGroup;
      const homeRow = groupMap[homeGroup]?.[fixture.home_team_id];
      const awayRow = groupMap[awayGroup]?.[fixture.away_team_id];
      if (!homeRow || !awayRow) continue;

      applyResultToRows(homeRow, awayRow, result.home_score, result.away_score);
    }

    for (const [groupName, rowsByTeam] of Object.entries(groupMap)) {
      groupStandings[groupName] = sortStandingRows(Object.values(rowsByTeam));
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "TBD";
    try {
      return format(parseISO(dateStr), "EEE d MMM yyyy");
    } catch {
      return dateStr;
    }
  }

  const prevMd =
    sortedMatchdays.filter((md) => md < selectedMatchday).at(-1) ?? null;
  const nextMd =
    sortedMatchdays.filter((md) => md > selectedMatchday)[0] ?? null;

  const mdComplete =
    mdMap[selectedMatchday]?.total > 0 &&
    mdMap[selectedMatchday]?.done === mdMap[selectedMatchday]?.total;

  const isCurrentMd =
    todayMatchdays.includes(selectedMatchday) ||
    selectedMatchday === currentMatchday;

  function PublicStandingsTable({
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
          const gd = (row.goals_for ?? 0) - (row.goals_against ?? 0);
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

          return (
            <div
              key={row.id ?? `${row.team_id}-${index}`}
              className={`grid grid-cols-[34px_1fr_32px_32px_32px_32px_42px_44px] items-center gap-2 px-3 py-2 text-xs border-l-4 ${qualificationBorder} ${index % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
            >
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

              <span className="text-center text-slate-600">{row.played}</span>
              <span className="text-center text-slate-600">{row.wins}</span>
              <span className="text-center text-slate-600">{row.draws}</span>
              <span className="text-center text-slate-600">{row.losses}</span>
              <span
                className={`text-center font-semibold ${gd >= 0 ? "text-green-600" : "text-red-500"}`}
              >
                {gd > 0 ? `+${gd}` : gd}
              </span>
              <span className="text-center font-black text-[#c9a84c]">
                {row.points}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Fixtures & Results
        </h1>
        {activeTournament && (
          <p className="text-sm text-[#c9a84c] mt-0.5">
            {activeTournament.name}
          </p>
        )}
      </div>

      {/* Tournament tabs */}
      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => {
            const isActive = t.id === activeTournamentId;
            return (
              <Link
                key={t.id}
                href={`/fixtures?tournament=${t.id}`}
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

      {/* Matchday navigation */}
      {sortedMatchdays.length > 1 && (
        <div className="flex items-center gap-3">
          {prevMd !== null ? (
            <Link
              href={`/fixtures?${activeTournamentId ? `tournament=${activeTournamentId}&` : ""}matchday=${prevMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-slate-900 transition-colors"
            >
              ← MD {prevMd}
            </Link>
          ) : (
            <div className="w-20" />
          )}

          <div className="flex-1 text-center">
            <span className="text-sm font-bold text-slate-900">
              {ROUND_LABELS[(fixtures?.[0] as any)?.round_type ?? ""] ??
                `Matchday ${selectedMatchday}`}
            </span>
            {isCurrentMd && (
              <span className="ml-2 text-[10px] bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Current
              </span>
            )}
            {mdComplete && (
              <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Complete
              </span>
            )}
          </div>

          {nextMd !== null ? (
            <Link
              href={`/fixtures?${activeTournamentId ? `tournament=${activeTournamentId}&` : ""}matchday=${nextMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-slate-900 transition-colors"
            >
              MD {nextMd} →
            </Link>
          ) : (
            <div className="w-20" />
          )}
        </div>
      )}

      {/* Fixtures list */}
      {!activeTournamentId ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No active tournaments.</p>
        </div>
      ) : (fixtures ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">
            No fixtures for Matchday {selectedMatchday}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(fixtures ?? []).map((f: any) => {
            const result = resultsByFixture[f.id] ?? null;
            const statusInfo =
              STATUS_STYLES[f.status] ?? STATUS_STYLES["scheduled"];
            const homeWin = result && result.home_score > result.away_score;
            const awayWin = result && result.away_score > result.home_score;
            const canSubmit = isAdmin && f.status !== "abandoned";

            return (
              <div key={f.id} className="flex items-center gap-2">
                <Link
                  href={`/fixtures/${f.id}`}
                  className="card flex-1 flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-black/[0.03] transition-all group"
                >
                  {/* Home team */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end flex-row-reverse sm:flex-row">
                    <span
                      className={`text-sm font-semibold truncate text-right sm:text-left ${
                        homeWin
                          ? "text-slate-900"
                          : awayWin
                            ? "text-slate-400"
                            : "text-slate-900"
                      }`}
                    >
                      {f.home_team?.name ?? "TBC"}
                    </span>
                    {f.home_team?.logo_league_folder && (
                      <div className="flex-shrink-0">
                        <TeamLogo
                          leagueFolder={f.home_team.logo_league_folder}
                          teamSlug={f.home_team.logo_team_slug}
                          context="standings_row"
                          alt={f.home_team.name}
                          className={`w-8 h-8 ${awayWin ? "opacity-40" : ""}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Centre */}
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    {result ? (
                      <span className="text-slate-900 font-bold text-lg leading-none">
                        {result.home_score}{" "}
                        <span className="text-slate-500">–</span>{" "}
                        {result.away_score}
                      </span>
                    ) : (
                      <span className="text-[#c9a84c] font-bold text-sm">
                        vs
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 text-center leading-tight">
                      {formatDate(f.scheduled_date)}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    {f.away_team?.logo_league_folder && (
                      <div className="flex-shrink-0">
                        <TeamLogo
                          leagueFolder={f.away_team.logo_league_folder}
                          teamSlug={f.away_team.logo_team_slug}
                          context="standings_row"
                          alt={f.away_team.name}
                          className={`w-8 h-8 ${homeWin ? "opacity-40" : ""}`}
                        />
                      </div>
                    )}
                    <span
                      className={`text-sm font-semibold truncate ${
                        awayWin
                          ? "text-slate-900"
                          : homeWin
                            ? "text-slate-400"
                            : "text-slate-900"
                      }`}
                    >
                      {f.away_team?.name ?? "TBC"}
                    </span>
                  </div>
                </Link>

                {canSubmit && (
                  <Link
                    href={`/admin/results/submit?fixture=${f.id}`}
                    className="shrink-0 px-3 py-2 text-xs font-semibold text-[#c9a84c] border border-[#c9a84c]/30 rounded-lg hover:bg-[#c9a84c]/10 transition-colors whitespace-nowrap"
                  >
                    Submit
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTournamentId &&
        isLeagueTournament &&
        leagueStandings.length > 0 && (
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  League Standings
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All tournament teams included, even before they play.
                </p>
              </div>
            </div>
            <PublicStandingsTable rows={leagueStandings} mode="league" />
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
          </div>
        )}

      {activeTournamentId &&
        isGroupTournament &&
        Object.keys(groupStandings).length > 0 && (
          <div className="card p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Group Standings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Built from tournament participants first, so teams with 0 games
                are shown.
              </p>
            </div>

            {Object.entries(groupStandings)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, rows]) => (
                <div key={groupName} className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#c9a84c]">
                    Group {groupName}
                  </h3>
                  <PublicStandingsTable rows={rows} mode="group" />
                </div>
              ))}

            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#c9a84c]" />
              Top 2 qualify
            </div>
          </div>
        )}
    </div>
  );
}
