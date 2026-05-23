import { cn } from '@/lib/utils'

/**
 * Text-only mark — no icon. `tone` picks colors for blue bars vs light backgrounds.
 */
export function AuthWordmark({
  variant = 'panel',
  tone = 'onDark',
  className,
}: {
  variant?: 'banner' | 'panel'
  /** onDark: white + ice blue on blue gradient. onLight: navy + accent blue on white (no dark chip). */
  tone?: 'onDark' | 'onLight'
  className?: string
}) {
  const isLight = tone === 'onLight'

  const sizeCls =
    variant === 'panel'
      ? isLight
        ? 'text-[1.65rem] sm:text-[1.85rem] lg:text-[2rem]'
        : 'text-[1.35rem] sm:text-[1.5rem]'
      : isLight
        ? 'text-[1.4rem] sm:text-[1.55rem]'
        : 'text-[1.25rem] sm:text-[1.35rem]'

  if (isLight) {
    return (
      <p
        className={cn(
          'm-0 select-none font-semibold leading-tight tracking-[0.08em] [font-family:var(--font-display)]',
          sizeCls,
          className
        )}
        aria-label="Kindo"
      >
        <span className="text-[#0B2D5E]">KIN</span>
        <span className="text-[#e8943a]">DO</span>
      </p>
    )
  }

  return (
    <p
      className={cn(
        'm-0 select-none font-semibold leading-tight tracking-[0.08em] [font-family:var(--font-display)]',
        sizeCls,
        className
      )}
      aria-label="Kindo"
    >
      <span className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">KIN</span>
      <span className="text-[#e8943a] drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">DO</span>
    </p>
  )
}
