export function StatCardsSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 28,
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            height: 100,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            animation: 'cp-pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes cp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div
      style={{
        background: 'var(--bg-app)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 44,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle)',
        }}
      />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            height: 48,
            borderBottom: i < 5 ? '1px solid var(--border-subtle)' : undefined,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 12,
              borderRadius: 4,
              background: 'var(--bg-muted)',
              animation: 'cp-pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes cp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export function MessagesSkeleton() {
  return (
    <div style={{ width: 320, flexShrink: 0, padding: 16 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'var(--bg-muted)',
              flexShrink: 0,
              animation: 'cp-pulse 1.5s ease-in-out infinite',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                height: 12,
                width: '60%',
                borderRadius: 4,
                background: 'var(--bg-muted)',
                marginBottom: 8,
                animation: 'cp-pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: 10,
                width: '90%',
                borderRadius: 4,
                background: 'var(--bg-muted)',
                animation: 'cp-pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes cp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export function DashboardHeaderSkeleton() {
  return (
    <div style={{ padding: '16px 0 24px' }}>
      <div
        style={{
          height: 28,
          width: 200,
          borderRadius: 6,
          background: 'var(--bg-muted)',
          marginBottom: 12,
          animation: 'cp-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 14,
          width: 280,
          borderRadius: 4,
          background: 'var(--bg-muted)',
          animation: 'cp-pulse 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes cp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
