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
      className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
    >
      <FileText size={14} className="text-gold" />
      {loading ? 'Generating…' : 'News Topic Export'}
    </button>
  )
}
