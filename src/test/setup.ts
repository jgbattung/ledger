import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement matchMedia, which ThemeProvider relies on to resolve
// the `system` theme. Provide a controllable mock defaulting to light.
type MediaListener = (e: MediaQueryListEvent) => void
const mediaListeners = new Set<MediaListener>()

export function setSystemDark(dark: boolean) {
  matchMediaState.matches = dark
  for (const listener of mediaListeners) {
    listener({ matches: dark } as MediaQueryListEvent)
  }
}

const matchMediaState = { matches: false }

// jsdom-only tests need the DOM/storage reset and the matchMedia stub; the
// node-environment PWA artifact test has none of these globals, so guard on it.
const isBrowserEnv = typeof window !== 'undefined'

beforeEach(() => {
  matchMediaState.matches = false
  mediaListeners.clear()
  if (!isBrowserEnv) return

  localStorage.clear()
  document.documentElement.classList.remove('dark')

  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        // Live getter so a later setSystemDark() is observable via media.matches,
        // mirroring a real MediaQueryList (which the snapshot form would not).
        get matches() {
          return matchMediaState.matches
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: MediaListener) => mediaListeners.add(cb),
        removeEventListener: (_: string, cb: MediaListener) => mediaListeners.delete(cb),
        addListener: (cb: MediaListener) => mediaListeners.add(cb),
        removeListener: (cb: MediaListener) => mediaListeners.delete(cb),
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
})

afterEach(() => {
  if (!isBrowserEnv) return
  cleanup()
  vi.unstubAllGlobals()
})
