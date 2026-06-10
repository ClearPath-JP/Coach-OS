import Link from 'next/link'

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Why Korva', href: '#founder' },
  ],
  Company: [
    { label: 'hello@foundos.ai', href: 'mailto:hello@foundos.ai' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--ink)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand col — KORVA wordmark */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <span
                className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.03em]"
                style={{ lineHeight: 1 }}
                aria-label="Korva"
              >
                <span className="text-[#faf7f0]">Kor</span>
                <span style={{ color: 'var(--belt-yellow)' }}>va</span>
              </span>
            </div>
            <p className="text-sm font-medium text-[#faf7f0]/55 max-w-xs leading-relaxed">
              The platform where coaches teach and students grow. Built by a coach, for coaches.
            </p>
          </div>

          {/* Link cols */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#faf7f0]/40 mb-4">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#faf7f0]/65 hover:text-[#faf7f0] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t-[3px] border-[#faf7f0]/12 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-[#faf7f0]/40">
            &copy; {new Date().getFullYear()} Korva. Built for coaches.
          </p>
          <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-[#faf7f0]/40">
            Your dojo, online.
          </p>
        </div>
      </div>
    </footer>
  )
}
