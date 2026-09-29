import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // lib/ holds Tailwind class name maps that are referenced from app/ but
    // declared in lib/ (e.g. ZONE_BORDER_CLASS in lib/standings-core.ts).
    // Without this scan those classes are never generated and render invisible.
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Declared as rgb(var(--channel) / <alpha-value>) — NOT var(--token) —
        // so Tailwind can synthesise the /opacity variants (bg-accent/15,
        // border-gold/40, ...). A plain `var(--color-*)` string silently
        // produces no CSS at all for any `/N` modifier.
        bg: {
          base: 'rgb(var(--color-bg-base-rgb) / <alpha-value>)',
          surface: 'rgb(var(--color-bg-surface-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--color-bg-elevated-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted-rgb) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--color-border-subtle-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-accent-muted-rgb) / <alpha-value>)',
        },
        feedback: {
          success: 'rgb(var(--color-feedback-success-rgb) / <alpha-value>)',
          warning: 'rgb(var(--color-feedback-warning-rgb) / <alpha-value>)',
          error: 'rgb(var(--color-feedback-error-rgb) / <alpha-value>)',
        },
        // Legacy aliases. The app was repainted from a navy/gold palette onto
        // bg/text/accent, but ~500 call sites were left behind on the old
        // names — they emitted nothing and rendered unstyled. These map the old
        // names onto the current tokens so those call sites work again.
        gold: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-accent-hover-rgb) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'rgb(var(--color-bg-base-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-bg-elevated-rgb) / <alpha-value>)',
          border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
        },
        foreground: {
          primary: 'rgb(var(--color-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted-rgb) / <alpha-value>)',
        },
      },
      spacing: {
        '1': 'var(--space-1)',
        '1.5': '6px',
        '2': 'var(--space-2)',
        '2.5': '10px',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)',
        '11': 'var(--space-11)',
        '12': 'var(--space-12)',
        'space-1': 'var(--space-1)',
        'space-1.5': '6px',
        'space-2': 'var(--space-2)',
        'space-2.5': '10px',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-7': 'var(--space-7)',
        'space-8': 'var(--space-8)',
        'space-9': 'var(--space-9)',
        'space-10': 'var(--space-10)',
        'space-11': 'var(--space-11)',
        'space-12': 'var(--space-12)',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
      lineHeight: {
        tight: 'var(--leading-tight)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-gold': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    // `tailwindcss-animate` is not installed, but its class names are already
    // used by BottomSheet, DNABadge, TeamStateBadge and the admin modals
    // (`animate-in`, `animate-scale-in`, `zoom-in-95`, `slide-in-from-bottom`).
    // They emitted nothing, so every dialog/sheet opened with no transition.
    //
    // These are declared as custom utilities rather than via
    // `theme.extend.animation` because that map only produces the
    // `animate-<key>` form: a key of `scale-in` yields `animate-scale-in`, and
    // it cannot produce the unprefixed `zoom-in-95` / `slide-in-from-bottom`
    // at all. All four resolve to the same motion so any combination of them
    // on one element stays coherent, and the keyframes live here so they are
    // emitted with the utilities that reference them.
    plugin(({ addUtilities }) => {
      addUtilities({
        '.animate-in': { animation: 'efaModalIn 0.18s ease-out' },
        '.animate-scale-in': { animation: 'efaModalIn 0.18s ease-out' },
        '.zoom-in-95': { animation: 'efaModalIn 0.18s ease-out' },
        '.slide-in-from-bottom': { animation: 'efaSheetUp 0.2s ease-out' },
        '@keyframes efaModalIn': {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        '@keyframes efaSheetUp': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      })
    }),
  ],
}

export default config
