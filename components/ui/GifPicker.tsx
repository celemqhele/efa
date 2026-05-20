'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface GifResult {
  id: string
  url: string
  preview: string
  title: string
}

interface Props {
  onSelect: (gif: GifResult) => void
  onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY

  // Load trending on open
  useEffect(() => {
    if (!apiKey) return
    fetchGifs('')
    // Close on outside click
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchGifs = async (q: string) => {
    if (!apiKey) return
    setLoading(true)
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`
      const res = await fetch(endpoint)
      const json = await res.json()
      setGifs(
        (json.data ?? []).map((g: any) => ({
          id: g.id,
          url: g.images.fixed_height.url,
          preview: g.images.fixed_height_small.url,
          title: g.title,
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => fetchGifs(query), 400)
    return () => clearTimeout(t)
  }, [query])

  if (!apiKey) {
    return (
      <div className="card p-4 text-center text-xs text-slate-400">
        GIF support requires NEXT_PUBLIC_GIPHY_API_KEY env var
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 w-80 card p-3 shadow-2xl shadow-black/30 z-50 border border-gold/20"
    >
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          className="input-field flex-1 text-sm py-1.5"
          autoFocus
        />
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1">×</button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-1 max-h-60 overflow-y-auto">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => { onSelect(gif); onClose() }}
              className="rounded overflow-hidden hover:ring-2 hover:ring-gold transition-all aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gif.preview} alt={gif.title} className="w-full h-full object-cover" />
            </button>
          ))}
          {gifs.length === 0 && !loading && (
            <div className="col-span-3 text-center text-slate-400 text-xs py-6">No GIFs found</div>
          )}
        </div>
      )}
      <p className="text-[9px] text-slate-500 mt-1.5 text-right">Powered by Giphy</p>
    </div>
  )
}
