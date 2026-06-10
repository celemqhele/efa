'use client'

import { useState } from 'react'

interface Props {
  fixtureId: string
  initialCode: string | null
  isHomeManager: boolean
}

export default function MatchroomCode({ fixtureId, initialCode, isHomeManager }: Props) {
  const [code, setCode] = useState(initialCode ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch(`/api/fixtures/${fixtureId}/matchroom`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchroom_code: code }),
    })
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-5 border-gold/30">
      <h2 className="section-header">
        <span className="text-gold">🎮</span> Matchroom Code
      </h2>

      {isHomeManager ? (
        /* Home manager — can edit */
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Create the matchroom in eFootball, then paste the room code here so your opponent can find it.
          </p>
          {editing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 12345678"
                className="input-field flex-1 text-lg font-mono tracking-widest"
                maxLength={20}
                autoFocus
              />
              <button onClick={save} disabled={saving} className="btn-gold shrink-0">
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-outline shrink-0 text-xs">
                Cancel
              </button>
            </div>
          ) : code ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl bg-gold/10 dark:bg-gold/5 border border-gold/30 text-center">
                <p className="text-2xl font-black text-gold tracking-[0.2em] font-mono">{code}</p>
                <p className="text-[10px] text-text-muted mt-1">Share this with your opponent</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={copy} className="btn-outline text-xs">
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
                <button onClick={() => setEditing(true)} className="btn-outline text-xs">
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="w-full py-4 border-2 border-dashed border-gold/30 rounded-xl text-gold text-sm font-medium hover:border-gold/60 hover:bg-gold/5 transition-colors">
              + Set Matchroom Code
            </button>
          )}
          {saved && <p className="text-xs text-green-400">✓ Saved</p>}
        </div>
      ) : (
        /* Away team / spectator — read only */
        code ? (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">Room code set by the home team:</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl bg-gold/10 dark:bg-gold/5 border border-gold/30 text-center">
                <p className="text-2xl font-black text-gold tracking-[0.2em] font-mono">{code}</p>
              </div>
              <button onClick={copy} className="btn-gold text-sm shrink-0">
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center border-2 border-dashed border-navy-border rounded-xl">
            <p className="text-text-muted text-sm">Waiting for home team to set the matchroom code…</p>
          </div>
        )
      )}
    </div>
  )
}

