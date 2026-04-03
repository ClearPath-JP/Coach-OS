import { cn } from '@/lib/utils'

type Tone = 'on-dark' | 'on-light'

/**
 * Wordmark only — no icon. ClearPath + Solutions in two colors.
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
      ? 'text-[15px] tracking-[-0.02em]'
      : size === 'lg'
        ? 'text-[20px] tracking-[-0.03em]'
        : 'text-[17px] tracking-[-0.025em]'

  return (
    <span className={cn('inline font-semibold', sizeCls, className)}>
      <span className={tone === 'on-dark' ? 'text-white' : 'text-[#111827]'}>ClearPath</span>
      <span className={tone === 'on-dark' ? 'text-[#3B9EE8]' : 'text-[#3B82F6]'}> Solutions</span>
    </span>
  )
}
