'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function ExportButton({
  filename,
  cardId,
  cardIds,
}: {
  filename: string
  cardId?: string
  cardIds?: string[]
}) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    const ids = cardId ? [cardId] : cardIds || []
    if (ids.length === 0) return

    setLoading(true)
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        const card = document.getElementById(id)
        if (!card) continue

        const dataUrl = await toPng(card, { pixelRatio: 2, cacheBust: true })
        const link = document.createElement('a')
        const currentFilename =
          ids.length > 1 ? filename.replace('.png', `-part-${i + 1}.png`) : filename
        link.download = currentFilename
        link.href = dataUrl
        link.click()

        if (ids.length > 1) {
          // Small delay between downloads to prevent browser blocking or race conditions
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setLoading(false)
    }
  }

  const ids = cardId ? [cardId] : cardIds || []

  return (
    <Button onClick={handleDownload} isLoading={loading}>
      {loading ? 'Generating...' : ids.length > 1 ? 'Download All PNGs' : 'Download PNG'}
    </Button>
  )
}

