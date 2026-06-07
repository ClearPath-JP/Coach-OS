export function ComingSoon({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        Coming soon
      </span>
      <h1 className="mb-3 text-2xl font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-[var(--text-tertiary)]">
        {blurb ?? "We're putting the finishing touches on this. As a founding member, you'll be first to get it the moment it's ready."}
      </p>
    </div>
  )
}
