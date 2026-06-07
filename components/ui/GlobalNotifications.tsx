'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { X, Trophy, AlertTriangle, UserPlus } from 'lucide-react'

interface Notification {
  id: string
  type: 'result' | 'sacked' | 'hired' | 'admin'
  title: string
  message: string
  data?: any
}

export default function GlobalNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  useEffect(() => {
    // 1. Initial check on mount
    checkLatestUpdates()

    // 2. Poll every 60 seconds (or use Realtime if preferred, but polling is safer for "since last visit")
    const interval = setInterval(checkLatestUpdates, 60000)
    return () => clearInterval(interval)
  }, [])

  async function checkLatestUpdates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const lastCheck = localStorage.getItem('efa_last_notif_check') || new Date(Date.now() - 3600000).toISOString()
    
    // Fetch notifications from the DB table
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setNotifications(prev => [...data.map(n => ({
        id: n.id,
        type: n.type as any,
        title: n.title,
        message: n.body,
        data: n.data
      })), ...prev].slice(0, 3))
    }

    localStorage.setItem('efa_last_notif_check', new Date().toISOString())
  }

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    // Mark as read in DB
    supabase.from('notifications').update({ read: true }).eq('id', id).then()
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {notifications.map((n) => (
        <div 
          key={n.id} 
          className="pointer-events-auto bg-white dark:bg-navy-card rounded-2xl shadow-2xl border border-navy-border p-4 animate-in slide-in-from-right-10 duration-300"
        >
          <div className="flex gap-3">
            <div className="shrink-0 pt-1">
              {n.type === 'result' && <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold"><Trophy size={20} /></div>}
              {n.type === 'sacked' && <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={20} /></div>}
              {n.type === 'hired' && <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500"><UserPlus size={20} /></div>}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-sm font-black text-foreground-primary truncate">{n.title}</h4>
                <button onClick={() => dismiss(n.id)} className="text-foreground-muted hover:text-foreground-primary transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-foreground-secondary leading-relaxed">{n.message}</p>
              
              {n.type === 'result' && n.data && (
                <div className="mt-3 flex items-center justify-center gap-4 p-2 rounded-xl bg-navy-light/50 border border-navy-border/50">
                  <div className="text-center">
                    <Image 
                      src={getTeamLogo(n.data.home_logo_folder, n.data.home_slug, 'standings_row')} 
                      alt="Home" width={24} height={24} className="object-contain mx-auto mb-1" 
                    />
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-tighter">{n.data.home_name}</p>
                  </div>
                  <div className="text-lg font-black text-foreground-primary">
                    {n.data.home_score} – {n.data.away_score}
                  </div>
                  <div className="text-center">
                    <Image 
                      src={getTeamLogo(n.data.away_logo_folder, n.data.away_slug, 'standings_row')} 
                      alt="Away" width={24} height={24} className="object-contain mx-auto mb-1" 
                    />
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-tighter">{n.data.away_name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
