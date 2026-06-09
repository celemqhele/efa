'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

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
    <Button
      onClick={handleDownload}
      isLoading={loading}
    >
      {loading ? 'Generating...' : 'Download PNG'}
    </Button>
  )
}

