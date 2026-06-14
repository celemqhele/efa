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

export function getDefaultUserTheme(): UserTheme {
  return {
    preset: 'default-dark',
    customBgUrl: null,
    colors: { ...DEFAULT_THEME_COLORS },
    overlayIntensity: 0.65,
  }
}

export const THEME_CHANGE_EVENT = 'efa-theme-change'

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function getLogoForTheme(): string {
  if (typeof document === 'undefined') return '/efa-logo-white.png'
  const bgBase = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-base').trim()
  if (!bgBase) return '/efa-logo-white.png'
  try {
    return hexLuminance(bgBase) < 0.5 ? '/efa-logo-white.png' : '/efa-logo-black.png'
  } catch {
    return '/efa-logo-white.png'
  }
}

function dispatchThemeChange() {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT))
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

  dispatchThemeChange()
}

export function resetThemeToDefaults() {
  const root = document.documentElement
  root.style.removeProperty('--theme-bg-image')
  root.style.removeProperty('--theme-bg-overlay')
  document.body.classList.remove('has-theme-bg')

  for (const [key] of Object.entries(DEFAULT_THEME_COLORS)) {
    root.style.removeProperty(key)
  }

  dispatchThemeChange()
}
