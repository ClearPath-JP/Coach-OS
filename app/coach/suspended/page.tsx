import Link from 'next/link'

export default function CoachSuspendedPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Your account is suspended</h1>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        This workspace has been suspended. If you believe this is a mistake, email{' '}
        <a href="mailto:hello@foundos.ai" className="font-medium text-[var(--accent)] hover:underline">
          hello@foundos.ai
        </a>{' '}
        and we&apos;ll take a look.
      </p>
      <Link href="/login" className="mt-8 text-sm font-medium text-[var(--accent)] hover:underline">
        Back to login
      </Link>
    </div>
  )
}
