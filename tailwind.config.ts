import type { Config } from 'tailwindcss'

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: {
        sensei: {
          accent: 'var(--accent)',
          'accent-dark': 'var(--accent-dark)',
          'accent-surface': 'var(--accent-surface)',
          ink: 'var(--text-primary)',
          muted: 'var(--text-tertiary)',
          surface: 'var(--bg-subtle)',
        },
      },
    },
  },
} satisfies Config
