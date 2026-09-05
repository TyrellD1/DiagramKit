import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  applySidebarOpacity,
  defaultSettings,
  readStoredSettings,
  writeStoredSettings,
  type AppSettings,
} from '@/lib/settings'

interface SettingsContextValue {
  settings: AppSettings
  setSidebarLeftOpacity: (value: number) => void
  setSidebarRightOpacity: (value: number) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function commit(next: AppSettings) {
  applySidebarOpacity(next)
  writeStoredSettings(next)
  return next
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const initial = typeof window === 'undefined' ? defaultSettings : readStoredSettings()
    applySidebarOpacity(initial)
    return initial
  })

  const setSidebarLeftOpacity = useCallback((sidebarLeftOpacity: number) => {
    setSettings(prev => commit({ ...prev, sidebarLeftOpacity }))
  }, [])

  const setSidebarRightOpacity = useCallback((sidebarRightOpacity: number) => {
    setSettings(prev => commit({ ...prev, sidebarRightOpacity }))
  }, [])

  const value = useMemo(
    () => ({ settings, setSidebarLeftOpacity, setSidebarRightOpacity }),
    [settings, setSidebarLeftOpacity, setSidebarRightOpacity],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
