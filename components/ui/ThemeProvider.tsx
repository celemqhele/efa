'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { applyThemeToDocument, getDefaultUserTheme, getPresetById, loadThemeFromStorage, saveThemeToStorage } from '@/lib/themes'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Apply cached theme instantly from localStorage (no network wait)
    const cached = loadThemeFromStorage()
    if (cached) applyThemeToDocument(cached)

    // 2. Sync with server in background for the latest saved theme
    async function syncTheme() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cached) applyThemeToDocument(getDefaultUserTheme())
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('theme_preferences')
        .eq('id', user.id)
        .single()

      if (profile?.theme_preferences) {
        const saved = profile.theme_preferences as any
        let colors = saved.colors
        if (saved.preset && saved.preset !== 'custom' && !colors) {
          const preset = getPresetById(saved.preset)
          if (preset) colors = preset.colors
        }
        const theme = {
          preset: saved.preset ?? null,
          customBgUrl: saved.customBgUrl ?? null,
          colors: colors ?? getDefaultUserTheme().colors,
          overlayIntensity: saved.overlayIntensity ?? 0.65,
        }
        applyThemeToDocument(theme)
        saveThemeToStorage(theme)
      } else if (!cached) {
        applyThemeToDocument(getDefaultUserTheme())
      }
    }
    syncTheme()
  }, [])

  return <>{children}</>
}
