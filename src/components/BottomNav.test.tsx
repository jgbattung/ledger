import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

/**
 * Bottom-nav structure and touch-target contract (design-system: >=44px, primary
 * actions >=56px). jsdom has no layout engine, so the size is asserted via the
 * `--touch-primary`-backed utility class rather than a computed pixel height.
 *
 * LG-049: four destinations plus a center action. The FAB is deliberately a
 * button and not a link - it opens the quick-action sheet rather than
 * navigating, so it must stay out of `aria-current`.
 */

function renderNav(initial = '/', onQuickActions = () => {}) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <BottomNav onQuickActions={onQuickActions} />
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Primary' })

describe('BottomNav', () => {
  it('renders exactly four labelled destinations', () => {
    renderNav()
    const links = within(nav()).getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links.map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Workout',
      'Levels',
      'More',
    ])
  })

  it('applies the 56px primary touch-target token to every tab', () => {
    renderNav()
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link.className).toContain('min-h-touch-primary')
    }
  })

  it('renders the quick-action FAB as a button, not a destination', () => {
    renderNav()
    const fab = within(nav()).getByRole('button', { name: 'Quick actions' })
    expect(fab).toHaveAttribute('type', 'button')
    // It is an action: it must never participate in the active-tab contract.
    expect(fab).not.toHaveAttribute('aria-current')
    expect(within(nav()).queryByRole('link', { name: 'Quick actions' })).toBeNull()
  })

  it('marks only the current route as active', () => {
    renderNav('/levels')
    expect(within(nav()).getByRole('link', { name: 'Levels' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
    const active = within(nav())
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page')
    expect(active).toHaveLength(1)
  })

  it('fires the quick-actions callback when the FAB is pressed', async () => {
    const onQuickActions = vi.fn()
    const user = userEvent.setup()
    renderNav('/', onQuickActions)

    await user.click(within(nav()).getByRole('button', { name: 'Quick actions' }))
    expect(onQuickActions).toHaveBeenCalledTimes(1)
  })
})
