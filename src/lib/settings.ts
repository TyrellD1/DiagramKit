export const SETTINGS_STORAGE_KEY = 'diagramkit-settings'
export const DEFAULT_SIDEBAR_OPACITY = 100

export type AppSettings = {
  sidebarLeftOpacity: number
  sidebarRightOpacity: number
}

export const defaultSettings: AppSettings = {
  sidebarLeftOpacity: DEFAULT_SIDEBAR_OPACITY,
  sidebarRightOpacity: DEFAULT_SIDEBAR_OPACITY,
}

export function clampOpacity(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SIDEBAR_OPACITY
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function parseOpacity(raw: string, fallback = DEFAULT_SIDEBAR_OPACITY): number {
  const trimmed = raw.trim()
  if (trimmed === '') return fallback
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n)) return fallback
  return clampOpacity(n)
}

export function normalizeSettings(raw: unknown): AppSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    sidebarLeftOpacity: clampOpacity(
      typeof o.sidebarLeftOpacity === 'number' ? o.sidebarLeftOpacity : DEFAULT_SIDEBAR_OPACITY,
    ),
    sidebarRightOpacity: clampOpacity(
      typeof o.sidebarRightOpacity === 'number' ? o.sidebarRightOpacity : DEFAULT_SIDEBAR_OPACITY,
    ),
  }
}

export function readStoredSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return { ...defaultSettings }
    return normalizeSettings(JSON.parse(stored) as unknown)
  } catch {
    return { ...defaultSettings }
  }
}

export function writeStoredSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

export function applySidebarOpacity(settings: AppSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--sidebar-left-opacity', String(settings.sidebarLeftOpacity / 100))
  root.style.setProperty('--sidebar-right-opacity', String(settings.sidebarRightOpacity / 100))
}
