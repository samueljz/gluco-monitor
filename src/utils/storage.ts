export function readJSON<T>(key: string, guard: (value: unknown) => value is T, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback

  try {
    const parsed = JSON.parse(raw)
    if (guard(parsed)) return parsed
    console.warn(`Ignoring malformed data for localStorage key "${key}"`)
    return fallback
  } catch (e) {
    console.error(`Failed to parse localStorage key "${key}"`, e)
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export const DATA_VERSION_KEY = 'gdm_data_version'

interface Migration {
  from: number;
  to: number;
  migrate: () => void;
}

// Ordered migration steps. Each step is applied only when the stored version
// exactly matches `from`, then the version is bumped to `to`. Add new shape
// changes here (bump the version + write a real migrate() step) instead of
// inventing a new suffixed key name like the old "gdm_schedule_v9" pattern.
const MIGRATIONS: Migration[] = [
  // Pre-versioning data (the "gdm_schedule_v9" / gdm_readings_* keys already
  // in users' browsers) is the v1 baseline. This step is a no-op on the data
  // itself — it only stamps the version so future migrations have a known
  // starting point.
  { from: 0, to: 1, migrate: () => {} },
]

export function getDataVersion(): number {
  const raw = localStorage.getItem(DATA_VERSION_KEY)
  if (raw === null) return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export function migrateStorage(): void {
  let version = getDataVersion()
  for (const step of MIGRATIONS) {
    if (version !== step.from) continue
    step.migrate()
    version = step.to
    localStorage.setItem(DATA_VERSION_KEY, String(version))
  }
}
