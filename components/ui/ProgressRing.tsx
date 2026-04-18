'use client'

export function ProgressRing({
  percentage,
  size = 36,
  label,
}: {
  percentage: number
  size?: number
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage)))
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference
  const gradientId = `ring-grad-${size}`

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent, #9f1239)" />
            <stop offset="100%" stopColor="var(--accent-hover, #be123c)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={stroke}
        />
        {/* Fill with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 800ms var(--ease-out)' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-[var(--text-primary)]">{label ?? `${pct}%`}</span>
    </div>
  )
}
