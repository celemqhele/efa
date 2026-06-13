'use client'

import { useState, useRef, useCallback } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  avatarUrl: string | null
  username: string
}

export default function AvatarUpload({ avatarUrl, username }: Props) {
  const [uploading, setUploading] = useState(false)
  const [showCrop, setShowCrop] = useState(false)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cropSize = 256

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return
    if (f.size > 10 * 1024 * 1024) return

    const reader = new FileReader()
    reader.onload = () => {
      setSourceImg(reader.result as string)
      setZoom(1)
      setTranslate({ x: 0, y: 0 })
      setShowCrop(true)
    }
    reader.readAsDataURL(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true)
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    setTranslate({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  function handleMouseUp() {
    setDragging(false)
  }

  async function handleApplyCrop() {
    if (!sourceImg || !containerRef.current) return

    const img = new Image()
    img.src = sourceImg
    await new Promise((resolve) => { img.onload = resolve })

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const displaySize = containerRect.width

    const scale = img.naturalWidth / (displaySize * zoom)
    const cropX = (-translate.x + (displaySize - cropSize * zoom) / 2) * scale
    const cropY = (-translate.y + (displaySize - cropSize * zoom) / 2) * scale
    const cropW = cropSize * zoom * scale
    const cropH = cropSize * zoom * scale

    const canvas = document.createElement('canvas')
    canvas.width = cropSize
    canvas.height = cropSize
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropSize, cropSize)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      setShowCrop(false)
      setUploading(true)

      const form = new FormData()
      form.append('file', blob, 'avatar.png')

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const data = await res.json()

      setUploading(false)

      if (res.ok && data.avatar_url) {
        window.location.reload()
      }
    }, 'image/png')
  }

  const hasAvatar = !!avatarUrl

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative w-24 h-24 rounded-full overflow-hidden bg-bg-elevated ring-2 ring-accent/40 hover:ring-accent transition-all group cursor-pointer disabled:opacity-50"
        title="Change profile picture"
      >
        {hasAvatar ? (
          <img src={avatarUrl!} alt={username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UserRound className="w-10 h-10 text-accent" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white text-[10px] font-bold uppercase tracking-wider">
            {uploading ? 'Uploading...' : 'Change'}
          </span>
        </div>
      </button>

      {/* Crop Modal */}
      {showCrop && sourceImg && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-space-4">
          <div className="w-full max-w-md bg-bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-space-6 py-space-4 border-b border-border">
              <h2 className="text-text-primary font-bold text-lg">Crop Profile Picture</h2>
            </div>

            <div className="p-space-6 space-y-space-4">
              <div
                ref={containerRef}
                className="relative mx-auto w-64 h-64 rounded-full overflow-hidden bg-bg-base cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={sourceImg}
                  alt="Crop preview"
                  className="absolute pointer-events-none"
                  style={{
                    width: `${zoom * 100}%`,
                    height: `${zoom * 100}%`,
                    transform: `translate(${translate.x}px, ${translate.y}px)`,
                    maxWidth: 'none',
                  }}
                  draggable={false}
                />
              </div>

              <div className="flex items-center gap-space-3">
                <span className="text-xs text-text-muted">Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-accent"
                />
              </div>

              <p className="text-xs text-text-muted text-center">Drag to reposition · Scroll to zoom</p>
            </div>

            <div className="px-space-6 pb-space-6 flex justify-between gap-space-3">
              <Button variant="secondary" onClick={() => setShowCrop(false)}>Cancel</Button>
              <Button onClick={handleApplyCrop}>Apply</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
