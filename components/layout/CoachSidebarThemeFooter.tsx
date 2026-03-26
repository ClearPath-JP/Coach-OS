'use client'

import { useTheme } from '@/components/ThemeProvider'

function ThemeToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors duration-150 ease-in ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
      }`}
      aria-pressed={checked}
      aria-label={checked ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-[var(--color-bg)] shadow-sm transition-all duration-150 ease-in ${
          checked ? 'left-[16px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

/** Bottom of coach sidebar: sun / toggle / moon + “Dark mode” label */
export function CoachSidebarThemeFooter() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--color-border)]">
      <SunIcon className="shrink-0 text-[var(--color-text-secondary)]" />
      <ThemeToggleSwitch checked={isDark} onChange={(on) => setTheme(on ? 'dark' : 'light')} />
      <MoonIcon className="shrink-0 text-[var(--color-text-secondary)]" />
      <span className="text-[15px] font-medium text-[var(--color-text-primary)]">Dark mode</span>
    </div>
  )
}
