import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'
import { setSystemDark } from '../test/setup'

/**
 * Theme toggle behaviour (AC-8): light/dark/system resolve correctly, apply the
 * `.dark` class to <html> live, and persist the user's choice to localStorage.
 * This is the live-theme verification the Builder flagged as browser-only.
 */

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

const isDark = () => document.documentElement.classList.contains('dark')

describe('ThemeProvider', () => {
  it('defaults to system and resolves to the OS preference (light)', () => {
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(isDark()).toBe(false)
  })

  it('applies the dark class live and persists the choice on toggle', async () => {
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'dark' }))
    expect(isDark()).toBe(true)
    expect(localStorage.getItem('ledger-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'light' }))
    expect(isDark()).toBe(false)
    expect(localStorage.getItem('ledger-theme')).toBe('light')
  })

  it('follows live OS changes when in system mode', async () => {
    renderProbe()
    expect(isDark()).toBe(false)

    act(() => setSystemDark(true))
    expect(isDark()).toBe(true)
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    act(() => setSystemDark(false))
    expect(isDark()).toBe(false)
  })

  it('restores a persisted theme from localStorage on mount', () => {
    localStorage.setItem('ledger-theme', 'dark')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(isDark()).toBe(true)
  })

  it('ignores an invalid stored value and falls back to system', () => {
    localStorage.setItem('ledger-theme', 'neon')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })
})
