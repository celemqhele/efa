'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { applyThemeToDocument, getDefaultUserTheme, getPresetById } from '@/lib/themes'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function loadTheme() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        applyThemeToDocument(getDefaultUserTheme())
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
        applyThemeToDocument({
          preset: saved.preset ?? null,
          customBgUrl: saved.customBgUrl ?? null,
          colors: colors ?? getDefaultUserTheme().colors,
          overlayIntensity: saved.overlayIntensity ?? 0.65,
        })
      } else {
        applyThemeToDocument(getDefaultUserTheme())
      }
    }
    loadTheme()
  }, [])

  return <>{children}</>
}
