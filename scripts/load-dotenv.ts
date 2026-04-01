import { config as loadEnv } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Set after `loadProjectDotenv` so scripts can print it in errors. */
export let lastLoadedDotenvPath: string | null = null

function isClearPathV2Root(dir: string): boolean {
  const pkgPath = resolve(dir, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string }
    return pkg.name === 'clearpath-v2'
  } catch {
    return false
  }
}

function findClearPathV2RootWalkingUp(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 14; i++) {
    if (isClearPathV2Root(dir)) return resolve(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Load `.env.local` from the repo root.
 *
 * If the shell `cwd` is already this app (folder with `package.json` name `clearpath-v2`),
 * that folder wins — fixes cases where `tsx`/`import.meta.url` points at another copy of the repo.
 */
export function loadProjectDotenv(entryImportMetaUrl: string): void {
  const entryDir = dirname(fileURLToPath(entryImportMetaUrl))

  const root = isClearPathV2Root(process.cwd())
    ? resolve(process.cwd())
    : findClearPathV2RootWalkingUp(entryDir) ?? resolve(entryDir, '..')

  const envPath = resolve(root, '.env.local')
  lastLoadedDotenvPath = envPath
  loadEnv({ path: envPath, override: true })
}
