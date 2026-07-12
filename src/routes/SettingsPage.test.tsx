import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { SettingsPage } from './SettingsPage'

/**
 * The shadcn Button (AC-2) is exercised here as the Settings theme toggle. It
 * must render, be themed via design-system tokens, and drive the theme live.
 */

function renderSettings() {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
  )
}

describe('SettingsPage theme toggle (shadcn Button)', () => {
  it('renders the three shadcn theme buttons', () => {
    renderSettings()
    for (const label of ['Light', 'Dark', 'System']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('uses the token-based default variant for the active theme and outline for the rest', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    const dark = screen.getByRole('button', { name: 'Dark' })
    const light = screen.getByRole('button', { name: 'Light' })

    // Active button is the primary (default) variant; inactive is outline.
    expect(dark).toHaveAttribute('data-variant', 'default')
    expect(dark.className).toContain('bg-primary')
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('data-variant', 'outline')
    expect(light).toHaveAttribute('aria-pressed', 'false')
  })

  it('meets the 44px minimum touch-target token on every theme button', () => {
    renderSettings()
    for (const label of ['Light', 'Dark', 'System']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-touch-min')
    }
  })
})
