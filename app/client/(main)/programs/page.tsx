import Link from 'next/link'
import { ClientProgramsContent } from './ClientProgramsContent'

export default function ClientProgramsPage() {
  return (
    <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
      <div className="mb-4">
        <Link
          href="/client/portal"
          className="text-[13px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
        >
          &larr; Home
        </Link>
      </div>
      <ClientProgramsContent />
    </main>
  )
}
