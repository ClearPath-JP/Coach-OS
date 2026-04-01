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
          'm-0 select-none font-semibold leading-tight tracking-[-0.03em] [font-family:var(--font-sora)]',
          sizeCls,
          className
        )}
        aria-label="ClearPath Solutions"
      >
        <span className="text-[#0B2D5E] lowercase">clearpath</span>
        <span className="mx-1.5 font-medium lowercase text-[var(--accent)]">solutions</span>
      </p>
    )
  }

  return (
    <p
      className={cn(
        'm-0 select-none font-semibold leading-tight tracking-[-0.03em] [font-family:var(--font-sora)]',
        sizeCls,
        className
      )}
      aria-label="ClearPath Solutions"
    >
      <span className="text-white lowercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">clearpath</span>
      <span className="mx-1.5 font-medium lowercase text-[#B3E5FC] drop-shadow-[0_1px_2px_rgba(13,71,161,0.2)]">
        solutions
      </span>
    </p>
  )
}
