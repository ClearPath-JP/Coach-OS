import Link from 'next/link'
import { SettingsPageContent } from './SettingsPageContent'

export default function CoachSettingsPage() {
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-4">
        <Link
          href="/coach/dashboard"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Dashboard
        </Link>
      </div>
      <SettingsPageContent />
    </main>
  )
}
