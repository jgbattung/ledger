import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

/**
 * Bottom-nav structure and touch-target contract (design-system: >=44px, primary
 * actions >=56px). jsdom has no layout engine, so the size is asserted via the
 * `--touch-primary`-backed utility class rather than a computed pixel height.
 */

function renderNav(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders exactly five labelled destinations', () => {
    renderNav()
    const links = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links.map((l) => l.textContent)).toEqual([
      'Today',
      'Library',
      'Programs',
      'Progress',
      'Settings',
    ])
  })

  it('applies the 56px primary touch-target token to every tab', () => {
    renderNav()
    const links = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link')
    for (const link of links) {
      expect(link.className).toContain('min-h-touch-primary')
    }
  })

  it('marks only the current route as active', () => {
    renderNav('/programs')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })
})
