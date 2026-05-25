import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Forgot password — KINDO dojo identity, matches the login page.
 */
export default function ForgotPasswordPage() {
  return (
    <div
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{ fontFamily: 'var(--font-dm-sans), var(--font)' }}
    >
      {/* ═══ FULL-SCREEN HERO IMAGE ═══ */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/images/newlogin.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Soft overlay */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0.3) 45%, rgba(5,5,8,0.55) 100%)' }} />

      {/* Subtle vignette */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)' }} />

      {/* ═══ TOP BAR ═══ */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(240,237,232,0.95)', lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
          KIN<span style={{ color: 'var(--accent)' }}>DO</span>
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(200,190,170,0.5)', textShadow: '0 1px 6px rgba(0,0,0,0.6)', margin: 0 }}>
          FOCUS. TRAIN. EVOLVE.
        </p>
      </div>

      {/* ═══ CARD ═══ */}
      <main
        aria-label="Reset password"
        className="relative z-10 w-full max-w-[400px] mx-4"
        style={{
          background: 'rgba(8, 8, 10, 0.72)',
          backdropFilter: 'blur(28px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
          border: '1px solid rgba(200, 170, 100, 0.14)',
          borderRadius: 16,
          padding: '32px 28px 28px',
          boxShadow: '0 0 60px rgba(200, 120, 40, 0.05), 0 20px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <ForgotPasswordForm />
      </main>
    </div>
  )
}
