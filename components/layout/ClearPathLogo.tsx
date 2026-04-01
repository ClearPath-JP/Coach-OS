export function ClearPathLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="0" y="0" width="28" height="28" rx="7" fill="var(--accent)" />
      <path
        d="M20.4 8.8H11.8C9.55 8.8 7.8 10.55 7.8 12.8V15.2C7.8 17.45 9.55 19.2 11.8 19.2H20.4V16.8H11.95C10.7 16.8 9.8 15.9 9.8 14.65V13.35C9.8 12.1 10.7 11.2 11.95 11.2H20.4V8.8Z"
        fill="white"
      />
    </svg>
  )
}
