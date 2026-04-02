import Link from 'next/link'

/** Inline link to the beginner-friendly admin tour (use on any admin page). */
export function AdminGuideLink({ className }: { className?: string }) {
  return (
    <Link
      href="/admin/guide"
      className={className ?? 'font-medium text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:decoration-blue-700'}
    >
      Admin guide
    </Link>
  )
}
