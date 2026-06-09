'use client'

import { useState } from 'react'
import { Trophy, FileText, X, ChevronRight } from 'lucide-react'
import { notify } from '@/lib/notifications'

interface Tournament {
  id: string
  name: string
  type: string
}

interface Props {
  tournaments: Tournament[]
}

export default function NewsTopicExportButton({ tournaments }: Props) {
  const [showModal, setShowResetConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleExport(tournamentId: string, tournamentName: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/generate-news-data?tournament_id=${tournamentId}`)
      const text = await res.text()
      if (!res.ok) throw new Error(text || 'Failed to generate news data')

      const blob = new Blob([text], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EFA_News_Export_${tournamentName.replace(/\s+/g, '_')}.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setShowResetConfirm(false)
    } catch (err: any) {
      notify('Error', err.message, 'admin')
    } finally {

      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowResetConfirm(true)}
        className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <FileText size={14} className="text-gold" />
        News Topic Generate
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-white dark:bg-navy-card rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-navy-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground-primary flex items-center gap-2">
                <Trophy size={20} className="text-gold" />
                Select Tournament
              </h3>
              <button onClick={() => setShowResetConfirm(false)} className="text-foreground-muted hover:text-foreground-primary">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-foreground-secondary mb-6">
              Select which competition you want to extract news data from. 
              This will compile results, form, and deep stats for all teams into a CSV.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-6">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  disabled={loading}
                  onClick={() => handleExport(t.id, t.name)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-navy-light/50 border border-navy-border hover:border-gold/50 hover:bg-gold/5 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground-primary">{t.name}</p>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-widest font-bold">{t.type}</p>
                  </div>
                  <ChevronRight size={18} className="text-foreground-muted group-hover:text-gold transition-colors" />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

