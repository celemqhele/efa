'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import {
  Bell, Trophy, AlertTriangle, UserPlus, X,
  CheckCircle, Swords, CalendarClock, Star,
  Flag, RefreshCw, Ban, Info,
} from 'lucide-react'

interface PopupNotification {
  key: string
  id?: string
  type: string
  title: string
  body: string
  data?: any
  created_at: string
}

const RESULT_TYPES = new Set(['result_confirmed'])

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  result_confirmed: <Trophy className="w-5 h-5" />,
  match_reminder: <Bell className="w-5 h-5" />,
  fixture_postponed: <CalendarClock className="w-5 h-5" />,
  fixtures_released: <Swords className="w-5 h-5" />,
  sacking: <AlertTriangle className="w-5 h-5" />,
  manager_sacked: <Ban className="w-5 h-5" />,
  deadline_warning: <AlertTriangle className="w-5 h-5" />,
  team_request: <UserPlus className="w-5 h-5" />,
  team_request_approved: <CheckCircle className="w-5 h-5" />,
  team_request_denied: <X className="w-5 h-5" />,
  team_request_reviewed: <Info className="w-5 h-5" />,
  qualification: <Star className="w-5 h-5" />,
  application_approved: <CheckCircle className="w-5 h-5" />,
  application_denied: <X className="w-5 h-5" />,
  backdoor_submitted: <UserPlus className="w-5 h-5" />,
  backdoor_approved: <CheckCircle className="w-5 h-5" />,
  backdoor_declined: <X className="w-5 h-5" />,
}

function notifIcon(type: string): React.ReactNode {
  return NOTIF_ICONS[type] ?? <Bell className="w-5 h-5" />
}

function notifIconColour(type: string): string {
  if (RESULT_TYPES.has(type) || type === 'qualification' || type === 'fixtures_released')
    return 'bg-accent/10 text-accent'
  if (type === 'sacking' || type === 'manager_sacked' || type === 'team_request_denied' || type === 'application_denied' || type === 'backdoor_declined')
    return 'bg-feedback-error/10 text-feedback-error'
  if (type === 'team_request_approved' || type === 'application_approved' || type === 'backdoor_approved')
    return 'bg-feedback-success/10 text-feedback-success'
  if (type === 'deadline_warning' || type === 'fixture_postponed' || type === 'backdoor_submitted')
    return 'bg-feedback-warning/10 text-feedback-warning'
  return 'bg-accent/10 text-accent'
}

// Play the uploaded custom notification sound. Best-effort: if the file can't
// load or autoplay is blocked, this fails silently and the OS notification
// sound is the fallback.
function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/efa-notify.mp3')
    audio.volume = 0.8
    audio.play().catch(() => {})
  } catch {
    // ignore
  }
}

function makeKey(n: { id?: string; type: string; title: string; body?: string }): string {
  return n.id ?? `${n.type}:${n.title}:${n.body ?? ''}`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ResultRow({ n, onClick }: { n: PopupNotification; onClick: () => void }) {
  const data = n.data ?? {}
  const homeScore = data.home_score ?? ''
  const awayScore = data.away_score ?? ''
  const fixtureId = data.fixture_id ?? null

  // Parse score from body if data missing: "Team A 3–1 Team B"
  const scoreMatch = !homeScore ? n.body.match(/(\d+)[–-](\d+)/) : null
  const displayHome = scoreMatch?.[1] ?? homeScore
  const displayAway = scoreMatch?.[2] ?? awayScore
  const label = n.body.replace(/\s*\d+[–-]\d+.*$/, '').trim()

  return (
    <button
      onClick={onClick}
      disabled={!fixtureId}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-surface border border-border hover:bg-bg-elevated transition-colors text-left disabled:cursor-default"
    >
      {data.home_logo_folder && data.home_slug ? (
        <Image
          src={getTeamLogo(data.home_logo_folder, data.home_slug, 'standings_row')}
          alt="Home" width={28} height={28}
          className="object-contain shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
          <Trophy className="w-3.5 h-3.5 text-accent" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground-primary truncate">{n.title}</p>
        <p className="text-[11px] text-text-muted truncate">{label || n.body}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-base font-black text-foreground-primary tabular-nums">{displayHome}</span>
        <span className="text-xs font-bold text-text-muted">–</span>
        <span className="text-base font-black text-foreground-primary tabular-nums">{displayAway}</span>
      </div>
    </button>
  )
}

function OtherRow({ n, onClick }: { n: PopupNotification; onClick: () => void }) {
  const data = n.data ?? {}
  const fixtureId = data.fixture_id ?? null

  return (
    <button
      onClick={onClick}
      disabled={!fixtureId && !data.team_id}
      className="w-full flex items-start gap-3 p-3 rounded-xl bg-bg-surface border border-border hover:bg-bg-elevated transition-colors text-left disabled:cursor-default"
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${notifIconColour(n.type)}`}>
        {notifIcon(n.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground-primary truncate">{n.title}</p>
        <p className="text-xs text-text-muted leading-relaxed mt-0.5">{n.body}</p>
      </div>
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GlobalNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<PopupNotification[]>([])
  const [others, setOthers] = useState<PopupNotification[]>([])
  const dismissedKeysRef = useRef<Set<string>>(new Set())
  const lastSoundAtRef = useRef(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkLatestUpdates()
    const interval = setInterval(checkLatestUpdates, 60000)

    const handleManualNotif = (e: any) => {
      const { title, message, type, data } = e.detail
      addNotifications([{
        key: `custom:${type}:${title}:${message}`,
        type: type || 'admin',
        title,
        body: message,
        data,
        created_at: new Date().toISOString(),
      }])
    }
    window.addEventListener('show-notification', handleManualNotif)

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'play-notification-sound') playNotificationSound()
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('show-notification', handleManualNotif)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [])

  async function checkLatestUpdates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const lastCheck = localStorage.getItem('efa_last_notif_check') || new Date(Date.now() - 3600000).toISOString()

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, data, created_at')
      .eq('user_id', user.id)
      .eq('read', false)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false }) as any

    if (data && data.length > 0) {
      addNotifications(data.map((n: any) => ({
        key: n.id,
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body ?? '',
        data: n.data,
        created_at: n.created_at,
      })))
    }

    localStorage.setItem('efa_last_notif_check', new Date().toISOString())
  }

  function addNotifications(newNotifs: PopupNotification[]) {
    const unseen = newNotifs.filter(n => !dismissedKeysRef.current.has(n.key))
    if (unseen.length === 0) return

    const existingKeys = new Set([...results, ...others].map(n => n.key))
    const trulyNew = unseen.filter(n => !existingKeys.has(n.key))
    if (trulyNew.length === 0) return

    // Play the custom sound for real notifications (skip manual "Saved" toasts).
    // Deduped so a push (SW message) and the 60s poll don't double-play.
    if (!trulyNew.every(n => n.key.startsWith('custom:'))) {
      const now = Date.now()
      if (now - lastSoundAtRef.current > 2000) {
        lastSoundAtRef.current = now
        playNotificationSound()
      }
    }

    const newResults = trulyNew.filter(n => RESULT_TYPES.has(n.type))
    const newOthers = trulyNew.filter(n => !RESULT_TYPES.has(n.type))

    setResults(prev => [...newResults, ...prev])
    setOthers(prev => [...prev, ...newOthers])
    setIsOpen(true)
  }

  async function handleDismiss() {
    const all = [...results, ...others]

    const realIds = all
      .map(n => n.id)
      .filter((id): id is string => !!id && id.includes('-'))

    if (realIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', realIds)
    }

    for (const n of all) dismissedKeysRef.current.add(n.key)

    setIsOpen(false)
    setResults([])
    setOthers([])
    router.refresh()
  }

  function handleItemClick(n: PopupNotification) {
    const data = n.data ?? {}
    if (data.url) router.push(data.url)
    else if (data.fixture_id) router.push(`/fixtures/${data.fixture_id}`)
    else if (data.team_id) router.push(`/teams/${data.team_id}`)
  }

  if (!isOpen) return null

  const hasResults = results.length > 0
  const hasOthers = others.length > 0
  const total = results.length + others.length

  return (
    <>
      {/* Backdrop — desktop only */}
      <div
        className="hidden sm:block fixed inset-0 bg-black/60 z-[100] animate-fade-in"
        onClick={handleDismiss}
      />

      {/* Popup */}
      <div
        className="
          fixed z-[101]
          inset-x-0 bottom-0 rounded-t-2xl
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:rounded-2xl sm:max-w-md sm:w-[calc(100vw-2rem)]
          bg-bg-elevated border border-border shadow-2xl
          animate-slide-up
        "
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground-primary text-base">
              {hasResults && total === results.length
                ? `${results.length} Result${results.length > 1 ? 's' : ''} Confirmed`
                : 'Notifications'}
            </h3>
            <p className="text-xs text-text-muted">
              {total === 1 ? '1 update' : `${total} updates`}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-5 pb-3 space-y-3">
          {hasResults && (
            <div>
              <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
                Results
              </h4>
              <div className="space-y-2">
                {results.map(n => (
                  <ResultRow
                    key={n.key}
                    n={n}
                    onClick={() => handleItemClick(n)}
                  />
                ))}
              </div>
            </div>
          )}

          {hasOthers && (
            <div>
              {hasResults && (
                <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
                  Updates
                </h4>
              )}
              <div className="space-y-2">
                {others.map(n => (
                  <OtherRow
                    key={n.key}
                    n={n}
                    onClick={() => handleItemClick(n)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3">
          <button
            onClick={handleDismiss}
            className="btn-gold w-full min-h-[44px] sm:min-h-0"
          >
            OK
          </button>
        </div>
      </div>
    </>
  )
}
