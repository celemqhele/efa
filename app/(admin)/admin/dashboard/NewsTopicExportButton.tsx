'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { notify } from '@/lib/notifications'

export default function NewsTopicExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-news-data')
      const text = await res.text()
      if (!res.ok) throw new Error(text || 'Failed to generate news data')

      const blob = new Blob([text], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EFA_News_Export_${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err: any) {
      notify('Error', err.message, 'admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="snap-start shrink-0 whitespace-nowrap text-sm font-semibold px-5 py-3 rounded-2xl min-h-[48px] flex items-center justify-center transition-colors bg-bg-surface/80 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 text-text-primary hover:bg-bg-surface disabled:opacity-50"
    >
      <FileText className="w-4 h-4 mr-1.5" />
      {loading ? 'Generating…' : 'News Topic Export'}
    </button>
  )
}
