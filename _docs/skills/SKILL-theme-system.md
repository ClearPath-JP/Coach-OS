# Skill: Theme system (dark / light + accent)

## Dark and light mode

- **Where it lives:** `components/ThemeProvider.tsx`, key `THEME_STORAGE_KEY` in `lib/theme.ts` (`clearpath-theme`).
- **Storage:** Browser **localStorage** only. It does **not** sync across devices or browsers. Clearing site data resets the preference.
- **Coach UI:** Sidebar footer (`CoachSidebarThemeFooter`) toggles dark mode. **Client portal:** Top nav can show the theme toggle when enabled.
- **Default:** On first visit, if nothing is stored, the app follows **`prefers-color-scheme`** until the user toggles (then the explicit choice is stored).

## Accent color (brand)

- **Where it lives:** `workspaces` row in Supabase (`accent_color`, `accent_color_light`), edited from **Settings → Appearance** (color theme grid).
- **Persistence:** Saved with the workspace — **same on every device** for that coach/workspace.
- **Application:** Coach layout injects CSS variables (`app/coach/layout.tsx`). Client-facing areas use workspace branding where applicable.

## Cross-device dark mode (not built yet)

To persist dark/light **per user across devices**, add a column on `profiles` (e.g. `theme_preference text check`) and sync on login from the client; keep localStorage as a fast cache if desired.

## Related files

- `app/globals.css` — `data-theme` and semantic colors
- `lib/theme.ts` — storage key constant
- `_design/D1-brand-identity.md` — default accent
