'use client'

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--cp-lavender)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-accent)',
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--cp-navy)', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--cp-gray)', maxWidth: 260, margin: '0 auto' }}>{subtitle}</p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: 4,
            height: 38,
            padding: '0 20px',
            background: 'var(--cp-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
