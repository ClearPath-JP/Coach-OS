# SKILL: Desktop UI Patterns — ClearPath Coach OS

## Design tokens (CSS variables)
```
--bg-app            Background of main content area
--bg-subtle         Card backgrounds
--bg-muted          Hover states, input backgrounds
--border-default    Standard card borders
--border-subtle     Dividers, inner borders
--text-primary      Headings, strong labels
--text-secondary    Sub-labels (preferred over tertiary for section headers)
--text-tertiary     Supporting text, timestamps
--text-quaternary   Placeholder, disabled
--accent            Primary accent color (coach-configurable)
--accent-light      Accent tint (background highlights)
--accent-muted      Accent border color
--nav-height        48px — top nav bar height
--sidebar-width     232px — coach sidebar width
```

## Standard card pattern
```tsx
<div className="overflow-hidden rounded-[12px] border border-[var(--border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
     style={{ background: 'var(--bg-subtle)' }}>
  {/* Card header */}
  <div className="flex h-10 items-center justify-between border-b border-[var(--border-subtle)] px-4">
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
      Section title
    </span>
    <Link href="..." className="text-[12px] font-medium text-[var(--cp-accent)]">View all →</Link>
  </div>
  {/* Card body */}
  <div className="p-4">...</div>
</div>
```

## Desktop 2-column layout pattern (coach dashboard)
```tsx
<div className="xl:grid xl:grid-cols-[1fr_380px] xl:gap-6 xl:items-start">
  {/* Left: main content */}
  <div className="flex flex-col gap-4">...</div>
  {/* Right: sticky rail */}
  <div className="flex flex-col gap-4 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-var(--nav-height))] xl:overflow-y-auto">
    ...
  </div>
</div>
```

## Desktop 2-column layout pattern (client portal)
```tsx
<div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-5 lg:items-start">
  {/* Left column */}
  <div className="flex flex-col gap-4">...</div>
  {/* Right rail */}
  <div className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-4">...</div>
</div>
```

## Section label standard
```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2">
  Section name
</p>
```

## Breakpoints used in this codebase
- sm: 640px (rare)
- md: 768px (padding scales)
- lg: 1024px (sidebar appears, bottom nav hides)
- xl: 1280px (2-column dashboard layout)

## Quick action button pattern
```tsx
<button
  type="button"
  onClick={() => router.push('/coach/...')}
  className="flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-3 text-left transition-all duration-[120ms] ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
>
  <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
    <Icon className="size-4" strokeWidth={2} aria-hidden />
  </span>
  <span className="min-w-0">
    <span className="block text-[13px] font-medium text-[var(--text-primary)]">Label</span>
    <span className="block text-[11px] text-[var(--text-tertiary)]">Subtitle</span>
  </span>
</button>
```

## Nav item (coach sidebar) active state
```tsx
'nav-item-active-coach bg-[var(--accent-light)] font-medium text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-muted)] [&_svg]:text-[var(--accent)]'
```

## Rules for desktop UI agents
- Always read full file(s) before editing
- Use `xl:` for the 2-column split (not `lg:`) on coach dashboard
- Use `lg:` for the 2-column split on client portal
- Never change mobile layout — preserve all `lg:hidden` and non-prefixed classes
- Add `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` to all card containers for subtle depth
- Max-width on all pages: `max-w-[1400px]`
- Do not change any API calls, auth logic, or Supabase queries
