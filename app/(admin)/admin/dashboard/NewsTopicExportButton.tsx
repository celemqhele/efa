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
      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-50"
    >
      <FileText className="w-5 h-5 shrink-0 text-text-muted" />
      {loading ? 'Generating…' : 'Generate News'}
    </button>
  )
}
