/**
 * In-card logo row (light card; hardcoded colors — not theme variables).
 */
export function AuthPremiumCardHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '32px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: '#3B9EE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'white', fontSize: '16px', fontWeight: 800 }}>C</span>
      </div>
      <span
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#0A1929',
          letterSpacing: '-0.02em',
        }}
      >
        ClearPath
      </span>
    </div>
  )
}
