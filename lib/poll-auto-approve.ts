/**
 * Closes the poll pick change window.
 *
 * A player picking a team stores status 'pending' + auto_approve_at = pick + 24h.
 * Withdrawing is a hard DELETE (see app/api/polls/[share_code]/withdraw/route.ts),
 * so any re-pick inserts a fresh row and restarts the timer from the new pick.
 * Once auto_approve_at has passed the pick becomes 'approved' and the withdraw
 * route refuses it, which removes the indefinite "pending" limbo players kept
 * asking about.
 *
 * Shared by the hourly cron route (app/api/cron/approve-poll-picks/route.ts) and
 * the one-off backfill script (scripts/approve-due-poll-picks.ts) so the two can
 * never drift apart.
 */
export async function approveDuePollPicks(supabase: any): Promise<{ approved: number; users: number }> {
  const { data: due, error } = await supabase
    .from('poll_applications')
    .update({ status: 'approved' })
    .eq('status', 'pending')
    .not('auto_approve_at', 'is', null)
    .lte('auto_approve_at', new Date().toISOString())
    .select('id, poll_id, applicant_id, team_name')

  if (error) throw new Error(error.message)

  const rows = (due ?? []) as any[]
  if (rows.length === 0) return { approved: 0, users: 0 }

  // Best-effort notification; a failed push must not fail the approval pass.
  const byUser = new Map<string, any[]>()
  for (const r of rows) {
    if (!byUser.has(r.applicant_id)) byUser.set(r.applicant_id, [])
    byUser.get(r.applicant_id)!.push(r)
  }

  for (const [userId, apps] of byUser) {
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'poll_application_approved',
      title: 'Team pick locked in',
      body: `Your pick for ${apps.map((a) => a.team_name).join(', ')} is now locked. You can no longer change it.`,
      data: { poll_id: apps[0].poll_id },
    })
    if (notifError) {
      console.error('[approve-poll-picks] notification failed:', notifError.message)
    }
  }

  return { approved: rows.length, users: byUser.size }
}
