'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'

export default function ExportButton({ filename, cardId }: { filename: string; cardId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    const card = document.getElementById(cardId)
    if (!card) return
    setLoading(true)
    try {
      const dataUrl = await toPng(card, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="px-4 py-2 bg-[#c9a84c] text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors text-sm disabled:opacity-60 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/40"
    >
      {loading ? 'Generating...' : 'Download PNG'}
    </button>
  )
}
