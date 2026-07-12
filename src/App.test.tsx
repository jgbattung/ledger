import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

/**
 * App-shell integration tests. These cover the browser-behaviour gaps the
 * Builder could not verify without a live browser: the shell renders with no
 * console errors, bottom-nav navigation reaches all five routes, and the active
 * tab reflects the current route (AC-1, AC-2, AC-3).
 */

const ROUTES = [
  { name: 'Today', heading: 'Today' },
  { name: 'Library', heading: 'Library' },
  { name: 'Programs', heading: 'Programs' },
  { name: 'Progress', heading: 'Progress' },
  { name: 'Settings', heading: 'Settings' },
]

function nav() {
  return screen.getByRole('navigation', { name: 'Primary' })
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

describe('App shell', () => {
  it('renders the Today route by default with the bottom nav', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    // All five destinations are present in the bottom nav.
    for (const route of ROUTES) {
      expect(within(nav()).getByRole('link', { name: route.name })).toBeInTheDocument()
    }
  })

  it('navigates to every route via the bottom nav and updates the active tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    for (const route of ROUTES) {
      const link = within(nav()).getByRole('link', { name: route.name })
      await user.click(link)

      // The destination screen renders.
      expect(
        screen.getByRole('heading', { level: 1, name: route.heading }),
      ).toBeInTheDocument()

      // The active tab reflects the current route (NavLink sets aria-current).
      expect(link).toHaveAttribute('aria-current', 'page')
      expect(link.className).toContain('text-primary')

      // Exactly one tab is active at a time.
      const active = within(nav())
        .getAllByRole('link')
        .filter((el) => el.getAttribute('aria-current') === 'page')
      expect(active).toHaveLength(1)
    }
  })

  it('renders the app shell with no console errors or warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<App />)
    // Exercise a full navigation cycle to surface any render-time errors.
    for (const route of ROUTES) {
      await user.click(within(nav()).getByRole('link', { name: route.name }))
    }

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('keeps Today inactive when a sibling route is active (exact-match end prop)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(nav()).getByRole('link', { name: 'Library' }))

    const today = within(nav()).getByRole('link', { name: 'Today' })
    expect(today).not.toHaveAttribute('aria-current', 'page')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
