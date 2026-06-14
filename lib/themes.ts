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

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default-dark',
    name: 'Default Dark',
    description: 'The classic dark theme',
    bgImage: '',
    colors: { ...DEFAULT_THEME_COLORS },
  },
  {
    id: 'midnight-forest',
    name: 'Midnight Forest',
    description: 'Deep purple tones with warm gold accents',
    bgImage: '/themes/midnight-forest.jpg',
    colors: {
      '--color-bg-base': '#120a15',
      '--color-bg-surface': '#1c1425',
      '--color-bg-elevated': '#2e1f3d',
      '--color-text-primary': '#F7FAFC',
      '--color-text-secondary': '#c4aec4',
      '--color-text-muted': '#7a5a7a',
      '--color-border': '#3a2a4a',
      '--color-accent': '#efc987',
      '--color-accent-hover': '#f4d9a0',
      '--color-accent-muted': '#2e2418',
    },
  },
  {
    id: 'warm-ember',
    name: 'Warm Ember',
    description: 'Rich coffee browns with amber highlights',
    bgImage: '/themes/warm-ember.jpg',
    colors: {
      '--color-bg-base': '#1a0f09',
      '--color-bg-surface': '#2e1a0c',
      '--color-bg-elevated': '#4a2a14',
      '--color-text-primary': '#fdefc2',
      '--color-text-secondary': '#d4b888',
      '--color-text-muted': '#8b7042',
      '--color-border': '#5a3a1a',
      '--color-accent': '#e19913',
      '--color-accent-hover': '#f0b030',
      '--color-accent-muted': '#2e2210',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    description: 'Intense dark reds with soft pink accents',
    bgImage: '/themes/crimson.jpg',
    colors: {
      '--color-bg-base': '#080105',
      '--color-bg-surface': '#2e0412',
      '--color-bg-elevated': '#530a21',
      '--color-text-primary': '#F7FAFC',
      '--color-text-secondary': '#f5b0c0',
      '--color-text-muted': '#9a4a5a',
      '--color-border': '#6b1a30',
      '--color-accent': '#f28eaa',
      '--color-accent-hover': '#f5b0c0',
      '--color-accent-muted': '#3a1420',
    },
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    description: 'Deep teals and dark aquas with bright teal accents',
    bgImage: '/themes/ocean-teal.jpg',
    colors: {
      '--color-bg-base': '#080f0e',
      '--color-bg-surface': '#0f2420',
      '--color-bg-elevated': '#1a4038',
      '--color-text-primary': '#e0f5f0',
      '--color-text-secondary': '#a6ccd5',
      '--color-text-muted': '#5a9a92',
      '--color-border': '#2a5a52',
      '--color-accent': '#14a88c',
      '--color-accent-hover': '#20c9a8',
      '--color-accent-muted': '#142e28',
    },
  },
  {
    id: 'sunset-peach',
    name: 'Sunset Peach',
    description: 'Warm navy and terracotta with golden peach glow',
    bgImage: '/themes/sunset-peach.jpg',
    colors: {
      '--color-bg-base': '#1a1e2a',
      '--color-bg-surface': '#2e2434',
      '--color-bg-elevated': '#5a3240',
      '--color-text-primary': '#f5ede0',
      '--color-text-secondary': '#e8c9a8',
      '--color-text-muted': '#a08070',
      '--color-border': '#6a4a40',
      '--color-accent': '#ebc395',
      '--color-accent-hover': '#f0d4a8',
      '--color-accent-muted': '#2e2420',
    },
  },
  {
    id: 'misty',
    name: 'Misty',
    description: 'Ethereal grays and muted tones for a calm atmosphere',
    bgImage: '/themes/misty.jpg',
    colors: {
      '--color-bg-base': '#14171c',
      '--color-bg-surface': '#1e2128',
      '--color-bg-elevated': '#2e323a',
      '--color-text-primary': '#e8e6e0',
      '--color-text-secondary': '#b8b4ae',
      '--color-text-muted': '#78746e',
      '--color-border': '#383c44',
      '--color-accent': '#b8b4ae',
      '--color-accent-hover': '#d0ccc4',
      '--color-accent-muted': '#282a2e',
    },
  },
]

export interface UserTheme {
  preset: string | null
  customBgUrl: string | null
  colors: ThemeColors
}

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(p => p.id === id)
}

export function getDefaultUserTheme(): UserTheme {
  return {
    preset: 'default-dark',
    customBgUrl: null,
    colors: { ...DEFAULT_THEME_COLORS },
  }
}

export function applyThemeToDocument(theme: UserTheme) {
  const root = document.documentElement

  // Apply background image
  const bgImage = theme.preset
    ? getPresetById(theme.preset)?.bgImage ?? ''
    : theme.customBgUrl ?? ''

  if (bgImage) {
    root.style.setProperty('--theme-bg-image', `url(${bgImage})`)
    root.style.setProperty('--theme-bg-overlay', 'rgba(0,0,0,0.65)')
    document.body.classList.add('has-theme-bg')
  } else {
    root.style.removeProperty('--theme-bg-image')
    root.style.removeProperty('--theme-bg-overlay')
    document.body.classList.remove('has-theme-bg')
  }

  // Apply colors
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
