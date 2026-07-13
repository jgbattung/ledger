import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider, useSettings, useTheme } from './SettingsProvider'
import { settings as settingsRepo } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { setSystemDark } from '@/test/setup'

/**
 * SettingsProvider is the app-wide source of truth for Settings (hydrated
 * from Dexie via getOrInit) and folds in theme handling with a localStorage
 * anti-flash cache.
 */

function SettingsProbe() {
  const { settings, updateSettings } = useSettings()
  return (
    <div>
      <span data-testid="rir">{settings ? settings.defaultRir : 'loading'}</span>
      <span data-testid="rest">{settings ? settings.defaultRestSeconds : 'loading'}</span>
      <span data-testid="warmups">{settings ? settings.defaultWarmupSetCount : 'loading'}</span>
      <span data-testid="unit">{settings ? settings.unit : 'loading'}</span>
      <span data-testid="theme-field">{settings ? settings.theme : 'loading'}</span>
      <span data-testid="week-start">{settings ? settings.weekStartsOn : 'loading'}</span>
      <button onClick={() => updateSettings({ defaultRir: 3 })}>bump-rir</button>
    </div>
  )
}

function ThemeProbe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { settings } = useSettings()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="hydrated">{settings ? 'yes' : 'no'}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  )
}

const isDark = () => document.documentElement.classList.contains('dark')

beforeEach(async () => {
  await resetDb()
})

describe('SettingsProvider hydration', () => {
  it('seeds PRD defaults on a fresh DB', async () => {
    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('rir')).toHaveTextContent('0')
    })
    expect(screen.getByTestId('rest')).toHaveTextContent('180')
    expect(screen.getByTestId('warmups')).toHaveTextContent('2')
    expect(screen.getByTestId('unit')).toHaveTextContent('kg')
    expect(screen.getByTestId('theme-field')).toHaveTextContent('system')
    expect(screen.getByTestId('week-start')).toHaveTextContent('mon')
  })

  it('persists updateSettings across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await screen.findByText('0')
    await user.click(screen.getByRole('button', { name: 'bump-rir' }))
    await waitFor(async () => {
      expect((await settingsRepo.get())?.defaultRir).toBe(3)
    })

    unmount()

    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('rir')).toHaveTextContent('3')
    })
  })
})

describe('SettingsProvider theme', () => {
  it('applies .dark live and writes the localStorage cache on setTheme', async () => {
    const user = userEvent.setup()
    render(
      <SettingsProvider>
        <ThemeProbe />
      </SettingsProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('yes'))

    await user.click(screen.getByRole('button', { name: 'dark' }))
    expect(isDark()).toBe(true)
    expect(localStorage.getItem('ledger-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'light' }))
    expect(isDark()).toBe(false)
    expect(localStorage.getItem('ledger-theme')).toBe('light')
  })

  it('follows live system changes in system mode', async () => {
    render(
      <SettingsProvider>
        <ThemeProbe />
      </SettingsProvider>,
    )
    await screen.findByTestId('theme')
    expect(isDark()).toBe(false)

    act(() => setSystemDark(true))
    expect(isDark()).toBe(true)
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    act(() => setSystemDark(false))
    expect(isDark()).toBe(false)
  })

  it('uses the stale localStorage cache before hydration, then Dexie wins', async () => {
    localStorage.setItem('ledger-theme', 'dark')

    render(
      <SettingsProvider>
        <ThemeProbe />
      </SettingsProvider>,
    )

    // Pre-hydration: cached value ('dark') is used immediately, no flash.
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(isDark()).toBe(true)

    // Dexie's seeded default ('system') wins once hydration completes.
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('system')
    })
  })
})
