'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Why Korva', href: '#founder' },
]

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
        {/* Logo — KORVA wordmark */}
        <Link href="/" className="flex items-center group" aria-label="Korva home">
          <span
            className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.12em]"
            style={{ lineHeight: 1 }}
          >
            <span className="text-[var(--text-primary)]">KOR</span>
            <span className="font-bold" style={{ color: 'var(--accent)' }}>VA</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-[var(--text-on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors px-5 py-2.5 rounded-xl"
          >
            Open Your Dojo
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[var(--text-secondary)]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-app)]"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-2"
                >
                  {link.label}
                </a>
              ))}
              <hr className="border-[var(--border-subtle)]" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-sm text-[var(--text-secondary)] py-2"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-center text-[var(--text-on-accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors px-5 py-2.5 rounded-xl"
              >
                Open Your Dojo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
