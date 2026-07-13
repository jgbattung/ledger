import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { settings as settingsRepo } from '@/db/repos'
import type { Settings, Theme } from '@/db/types'

const THEME_CACHE_KEY = 'ledger-theme'

function readCachedTheme(): Theme {
  const stored = localStorage.getItem(THEME_CACHE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function resolveSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type SettingsContextValue = {
  settings: Settings | null
  updateSettings: (patch: Partial<Omit<Settings, 'id' | 'createdAt'>>) => void
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cachedTheme] = useState<Theme>(readCachedTheme)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(resolveSystemTheme)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    settingsRepo.getOrInit().then((row) => {
      if (mountedRef.current) setSettings(row)
    })
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  // Pre-hydration: fall back to the localStorage cache so there is no
  // dark-mode flash. Once Dexie hydrates, settings.theme wins.
  const theme = settings ? settings.theme : cachedTheme
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  useEffect(() => {
    localStorage.setItem(THEME_CACHE_KEY, theme)
  }, [theme])

  const updateSettings = (patch: Partial<Omit<Settings, 'id' | 'createdAt'>>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    void settingsRepo.update(patch)
  }

  const setTheme = (next: Theme) => updateSettings({ theme: next })

  const value = useMemo(
    () => ({ settings, updateSettings, theme, resolvedTheme, setTheme }),
    [settings, theme, resolvedTheme],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useSettings()
  return { theme, resolvedTheme, setTheme }
}
