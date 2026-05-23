import { cn } from '@/lib/utils'

type Tone = 'on-dark' | 'on-light'

/**
 * KINDO wordmark — text only, KIN in primary tone, DO in amber.
 */
export function AuthBrandWordmark({
  tone,
  className,
  size = 'md',
}: {
  tone: Tone
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeCls =
    size === 'sm'
      ? 'text-[15px] tracking-[0.08em]'
      : size === 'lg'
        ? 'text-[20px] tracking-[0.1em]'
        : 'text-[17px] tracking-[0.09em]'

  return (
    <span
      className={cn('inline font-semibold [font-family:var(--font-display)]', sizeCls, className)}
      aria-label="Kindo"
    >
      <span className={tone === 'on-dark' ? 'text-white' : 'text-[#111827]'}>KIN</span>
      <span className="text-[#e8943a]">DO</span>
    </span>
  )
}
