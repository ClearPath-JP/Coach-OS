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
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 100,
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-border)',
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
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 44,
          borderBottom: '1px solid var(--cp-border)',
          background: 'var(--cp-offwhite)',
        }}
      />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            height: 48,
            borderBottom: i < 5 ? '1px solid var(--cp-border)' : undefined,
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
              background: 'var(--cp-offwhite)',
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
            borderBottom: '1px solid var(--cp-border)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'var(--cp-offwhite)',
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
                background: 'var(--cp-offwhite)',
                marginBottom: 8,
                animation: 'cp-pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: 10,
                width: '90%',
                borderRadius: 4,
                background: 'var(--cp-offwhite)',
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
          background: 'var(--cp-offwhite)',
          marginBottom: 12,
          animation: 'cp-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 14,
          width: 280,
          borderRadius: 4,
          background: 'var(--cp-offwhite)',
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
