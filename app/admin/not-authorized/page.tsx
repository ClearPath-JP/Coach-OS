import Link from 'next/link'

export default function AdminNotAuthorizedPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--cp-offwhite)', padding: '48px' }}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div
          className="flex size-20 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[36px]"
          aria-hidden
        >
          🔒
        </div>
        <h1 className="mt-8 text-xl font-medium tracking-[var(--tracking-heading)] text-[var(--text-primary)]">
          Access restricted
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-tertiary)]">
          This area is only accessible to FoundOS administrators.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/coach/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--cp-accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--cp-accent-hover)]"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-6 text-[15px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
          >
            Sign in differently
          </Link>
        </div>
      </div>
    </div>
  )
}
