'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'

export default function ExportButton({ filename }: { filename: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    const card = document.getElementById('export-card')
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
      className="px-5 py-2.5 bg-[#c9a84c] text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors text-sm disabled:opacity-60"
    >
      {loading ? 'Generating...' : 'Download PNG'}
    </button>
  )
}
