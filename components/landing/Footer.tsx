import Link from 'next/link'

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Why Kindo', href: '#founder' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-app)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand col — KINDO wordmark */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <span
                className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.12em]"
                style={{ lineHeight: 1 }}
                aria-label="Kindo"
              >
                <span className="text-[var(--text-primary)]">KIN</span>
                <span className="font-bold" style={{ color: 'var(--accent)' }}>DO</span>
              </span>
            </div>
            <p className="text-sm text-[var(--text-tertiary)] max-w-xs leading-relaxed">
              The platform where coaches teach and students grow. Built by a coach, for coaches.
            </p>
          </div>

          {/* Link cols */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)] mb-4">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-quaternary)]">
            &copy; {new Date().getFullYear()} Kindo. All rights reserved.
          </p>
          <p className="text-xs text-[var(--text-quaternary)]">
            Your dojo, online.
          </p>
        </div>
      </div>
    </footer>
  )
}
