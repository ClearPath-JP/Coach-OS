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
    <nav className="fixed top-0 left-0 right-0 z-50 border-b-[3px] border-[var(--ink)] bg-[var(--ink)]">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-5 h-16">
        {/* KORVA wordmark */}
        <Link href="/" className="flex items-center" aria-label="Korva home">
          <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.03em] text-[#faf7f0]">
            Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#faf7f0]/70 hover:text-[#faf7f0] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#faf7f0]/80 hover:text-[#faf7f0] px-3 py-2 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup?role=coach"
            className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--ink)] bg-[var(--belt-yellow)] border-2 border-[var(--ink)] rounded-[10px] px-4 py-2 shadow-[3px_3px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#b8910f] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            Start free trial
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[#faf7f0]"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t-[3px] border-[#faf7f0]/15 bg-[var(--ink)]"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#faf7f0]/75 py-2"
                >
                  {link.label}
                </a>
              ))}
              <hr className="border-[#faf7f0]/15" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#faf7f0]/80 py-2"
              >
                Log in
              </Link>
              <Link
                href="/signup?role=coach"
                onClick={() => setMobileOpen(false)}
                className="font-[family-name:var(--font-display)] text-sm font-bold text-center text-[var(--ink)] bg-[var(--belt-yellow)] border-2 border-[var(--ink)] rounded-[10px] px-5 py-2.5"
              >
                Start free trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
