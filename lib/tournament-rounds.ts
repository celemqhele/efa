/**
 * Shared knockout round metadata.
 *
 * Kept in its own module (rather than exported from lib/tournament-progression.ts)
 * because that file imports createAdminClient from @/lib/supabase/server, which is
 * server-only. Admin UI is client-rendered, so it needs these constants without
 * pulling the service-role client into the browser bundle.
 */

/** Every round_type that participates in knockout winner-progression. */
export const KO_ROUNDS: readonly string[] = ['r32', 'r16', 'qf', 'sf', 'final']

export const KO_ROUND_LABELS: Record<string, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
}

export function koRoundLabel(roundType: string | null | undefined): string {
  if (!roundType) return 'Knockout'
  return KO_ROUND_LABELS[roundType] ?? roundType.toUpperCase()
}
