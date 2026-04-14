import type { Config } from 'tailwindcss'

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: {
        got: {
          ink: 'var(--got-ink)',
          parchment: 'var(--got-parchment)',
          gold: 'var(--got-gold)',
          'gold-dim': 'var(--got-gold-dim)',
          crimson: 'var(--got-crimson)',
          steel: 'var(--got-steel)',
          bamboo: 'var(--got-bamboo)',
          frost: 'var(--got-frost)',
        },
      },
    },
  },
} satisfies Config
