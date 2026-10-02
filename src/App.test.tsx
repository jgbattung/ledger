import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import { ChromelessShell } from '@/routes/AppShell'

/**
 * App-shell integration tests. These cover the browser-behaviour gaps the
 * Builder could not verify without a live browser: the shell renders with no
 * console errors, bottom-nav navigation reaches every destination, and the
 * active tab reflects the current route (AC-1, AC-2, AC-3).
 *
 * LG-049: four destinations, not five. The exercise catalog and Settings moved
 * under More and are no longer bottom tabs.
 */

const ROUTES = [
  { name: 'Dashboard', heading: 'Dashboard' },
  { name: 'Workout', heading: 'Workout' },
  { name: 'Levels', heading: 'Levels' },
  { name: 'More', heading: 'More' },
]

function nav() {
  return screen.getByRole('navigation', { name: 'Primary' })
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

describe('App shell', () => {
  it('renders the Dashboard route by default with the bottom nav', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    // All four destinations are present in the bottom nav.
    for (const route of ROUTES) {
      expect(within(nav()).getByRole('link', { name: route.name })).toBeInTheDocument()
    }
    // The fifth slot is the quick-action launcher, not a destination.
    expect(within(nav()).getByRole('button', { name: 'Quick actions' })).toBeInTheDocument()
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
      // Active is ink, not brand - the brand color is reserved for the FAB.
      expect(link.className).not.toContain('text-muted-foreground')

      // Exactly one tab is active at a time.
      const active = within(nav())
        .getAllByRole('link')
        .filter((el) => el.getAttribute('aria-current') === 'page')
      expect(active).toHaveLength(1)
    }
  })

  it('reaches Settings and the Exercise Library through the More menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {
      await Promise.resolve()
    })

    await user.click(within(nav()).getByRole('link', { name: 'More' }))
    await user.click(screen.getByRole('link', { name: /Settings/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()

    await user.click(within(nav()).getByRole('link', { name: 'More' }))
    await user.click(screen.getByRole('link', { name: /Exercise Library/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
  })

  it('redirects an unmatched path to the Dashboard', async () => {
    // The old top-level routes were deleted outright, not redirected.
    window.history.pushState({}, '', '/library')
    render(<App />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders the app shell with no console errors or warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<App />)
    // SettingsProvider hydrates from Dexie asynchronously on mount; flush that
    // before interacting so its setState lands inside an act() boundary
    // instead of racing the click loop below.
    await act(async () => {
      await Promise.resolve()
    })
    // Exercise a full navigation cycle to surface any render-time errors.
    for (const route of ROUTES) {
      await user.click(within(nav()).getByRole('link', { name: route.name }))
    }
    // The quick-action sheet mounts a Radix dialog - open and close it too.
    await user.click(within(nav()).getByRole('button', { name: 'Quick actions' }))
    expect(screen.getByRole('dialog', { name: 'Quick actions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('keeps Dashboard inactive when a sibling route is active (exact-match end prop)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(nav()).getByRole('link', { name: 'Workout' }))

    const dashboard = within(nav()).getByRole('link', { name: 'Dashboard' })
    expect(dashboard).not.toHaveAttribute('aria-current', 'page')
  })
})

describe('ChromelessShell', () => {
  it('renders its outlet with no bottom nav', () => {
    // Proof for LG-010: the Ongoing Workout takeover mounts here and hides the
    // bar without touching shell code.
    render(
      <MemoryRouter initialEntries={['/session']}>
        <Routes>
          <Route element={<ChromelessShell />}>
            <Route path="session" element={<h1>Ongoing workout</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Ongoing workout' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })
})

describe('Program routes', () => {
  it('renders /programs/new without the bottom nav', async () => {
    window.history.pushState({}, '', '/programs/new')
    render(<App />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Program' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
