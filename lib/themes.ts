export interface ThemeColors {
  '--color-bg-base': string
  '--color-bg-surface': string
  '--color-bg-elevated': string
  '--color-text-primary': string
  '--color-text-secondary': string
  '--color-text-muted': string
  '--color-border': string
  '--color-accent': string
  '--color-accent-hover': string
  '--color-accent-muted': string
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  '--color-bg-base': '#0F1117',
  '--color-bg-surface': '#171A21',
  '--color-bg-elevated': '#242833',
  '--color-text-primary': '#F7FAFC',
  '--color-text-secondary': '#CBD5E0',
  '--color-text-muted': '#718096',
  '--color-border': '#2D323F',
  '--color-accent': '#D6B65D',
  '--color-accent-hover': '#E3C677',
  '--color-accent-muted': '#2E2818',
}

export interface ThemePreset {
  id: string
  name: string
  description: string
  bgImage: string
  colors: ThemeColors
}

export interface UserTheme {
  preset: string | null
  customBgUrl: string | null
  colors: ThemeColors
  overlayIntensity: number
}

import { ALL_PRESETS } from './all-presets'

const DEFAULT_DARK: ThemePreset = {
  id: 'default-dark',
  name: 'Default Dark',
  description: 'The classic dark theme',
  bgImage: '',
  colors: { ...DEFAULT_THEME_COLORS },
}

export const THEME_PRESETS: ThemePreset[] = [DEFAULT_DARK, ...ALL_PRESETS]

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(p => p.id === id)
}

export const THEME_STORAGE_KEY = 'efa-theme'

export function saveThemeToStorage(theme: UserTheme) {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)) } catch {}
  }
}

export function loadThemeFromStorage(): UserTheme | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY)
      if (raw) return JSON.parse(raw) as UserTheme
    } catch {}
  }
  return null
}

export function getDefaultUserTheme(): UserTheme {
  return {
    preset: 'default-dark',
    customBgUrl: null,
    colors: { ...DEFAULT_THEME_COLORS },
    overlayIntensity: 0.65,
  }
}

export function applyThemeToDocument(theme: UserTheme) {
  const root = document.documentElement

  const bgImage = theme.preset
    ? getPresetById(theme.preset)?.bgImage ?? ''
    : theme.customBgUrl ?? ''

  if (bgImage) {
    root.style.setProperty('--theme-bg-image', `url(${bgImage})`)
    root.style.setProperty('--theme-bg-overlay', `rgba(0,0,0,${theme.overlayIntensity})`)
    document.body.classList.add('has-theme-bg')
  } else {
    root.style.removeProperty('--theme-bg-image')
    root.style.removeProperty('--theme-bg-overlay')
    document.body.classList.remove('has-theme-bg')
  }

  const colors = theme.colors
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value)
  }
}

export function resetThemeToDefaults() {
  const root = document.documentElement
  root.style.removeProperty('--theme-bg-image')
  root.style.removeProperty('--theme-bg-overlay')
  document.body.classList.remove('has-theme-bg')

  for (const [key] of Object.entries(DEFAULT_THEME_COLORS)) {
    root.style.removeProperty(key)
  }
}
