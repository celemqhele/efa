'use client'

import { useState, useEffect } from 'react'
import { Palette, Upload, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import {
  THEME_PRESETS,
  getPresetById,
  applyThemeToDocument,
  type UserTheme,
} from '@/lib/themes'

export default function ThemeSettings() {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets')
  const [activePreset, setActivePreset] = useState<string>('default-dark')

  // Load current theme from stored preference on mount
  useEffect(() => {
    async function loadCurrent() {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('theme_preferences')
        .single()
      if (data?.theme_preferences) {
        const prefs = data.theme_preferences as any
        if (prefs.preset) setActivePreset(prefs.preset)
      }
    }
    loadCurrent()
  }, [])

  async function selectPreset(presetId: string) {
    setSaving(true)
    const preset = getPresetById(presetId)
    if (!preset) return

    const theme: UserTheme = {
      preset: presetId,
      customBgUrl: null,
      colors: { ...preset.colors },
    }

    applyThemeToDocument(theme)
    setActivePreset(presetId)

    try {
      await fetch('/api/profile/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: presetId }),
      })
    } catch (e) {
      console.error('Failed to save theme', e)
    }
    setSaving(false)
  }

  async function handleCustomUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return

    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)

      const res = await fetch('/api/profile/theme/extract', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const theme: UserTheme = {
        preset: 'custom',
        customBgUrl: data.bgUrl ?? '',
        colors: data.colors,
      }

      applyThemeToDocument(theme)
      document.documentElement.style.setProperty('--theme-bg-overlay', 'rgba(0,0,0,0.55)')
      setActivePreset('custom')

      await fetch('/api/profile/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'custom', customBgUrl: data.bgUrl, colors: data.colors }),
      })
    } catch (e) {
      console.error('Failed to upload theme', e)
    }
    setUploading(false)
  }

  return (
    <Card className="p-space-5 space-y-space-4">
      <h2 className="section-header">
        <Palette className="w-5 h-5 text-accent" /> Theme
      </h2>

      <div className="flex gap-space-2 bg-bg-base rounded-lg p-space-1 border border-border w-fit">
        <button
          onClick={() => setActiveTab('presets')}
          className={`px-space-3 py-space-1.5 rounded-md text-xs font-bold transition-all ${
            activeTab === 'presets'
              ? 'bg-accent text-bg-surface'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
          Presets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-space-3 py-space-1.5 rounded-md text-xs font-bold transition-all ${
            activeTab === 'custom'
              ? 'bg-accent text-bg-surface'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Upload className="w-3.5 h-3.5 inline mr-1.5" />
          Custom
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-3">
          {THEME_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset.id)}
                disabled={saving}
                className={`group relative rounded-xl border-2 overflow-hidden transition-all text-left ${
                  isActive
                    ? 'border-accent ring-2 ring-accent/30'
                    : 'border-border hover:border-accent/50'
                }`}
              >
                <div className="h-20 relative bg-bg-base overflow-hidden">
                  {preset.bgImage ? (
                    <img
                      src={preset.bgImage}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center gap-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.colors['--color-accent'] }}
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.colors['--color-bg-surface'] }}
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.colors['--color-bg-base'] }}
                      />
                    </div>
                  )}
                  <div className="absolute inset-x-2 bottom-2 h-6 rounded-md"
                    style={{ backgroundColor: preset.colors['--color-bg-surface'] }}
                  />
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-3 h-3 text-bg-surface" />
                    </div>
                  )}
                </div>
                <div className="p-space-2.5">
                  <p className="text-xs font-bold text-text-primary truncate">{preset.name}</p>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-tight line-clamp-2">{preset.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-space-4">
          <div className="border-2 border-dashed border-border rounded-xl p-space-8 text-center hover:border-accent/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="theme-upload"
              onChange={handleCustomUpload}
              disabled={uploading}
            />
            <label
              htmlFor="theme-upload"
              className="cursor-pointer flex flex-col items-center gap-space-3"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">
                  {uploading ? 'Extracting palette...' : 'Upload your own image'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Your colors will be extracted automatically
                </p>
              </div>
              <Button variant="secondary" disabled={uploading} className="pointer-events-none">
                {uploading ? 'Processing...' : 'Choose Image'}
              </Button>
            </label>
          </div>

          {activePreset === 'custom' && (
            <div className="flex items-center gap-space-3 p-space-3 rounded-lg bg-accent/5 border border-accent/20">
              <Check className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs text-text-secondary">
                Custom theme active. Upload a new image to change it.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
