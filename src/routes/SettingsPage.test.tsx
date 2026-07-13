import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { SettingsPage } from './SettingsPage'
import { settings as settingsRepo } from '@/db/repos'
import { resetDb } from '@/db/test-utils'

/**
 * LG-003 Settings screen: all six SET-1 fields (default RIR, default rest,
 * warm-up sets, units, theme, week-start), each persisting to the single
 * Dexie settings row, with a skeleton shown during hydration.
 */

function renderSettings() {
  return render(
    <SettingsProvider>
      <SettingsPage />
    </SettingsProvider>,
  )
}

const isDark = () => document.documentElement.classList.contains('dark')

beforeEach(async () => {
  await resetDb()
})

describe('SettingsPage', () => {
  it('shows skeleton rows before hydration, then renders real content', async () => {
    renderSettings()

    // Immediately after render, hydration has not resolved yet.
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(document.querySelectorAll('.animate-pulse').length).toBe(0)
    })
    expect(screen.getByText('Default RIR')).toBeInTheDocument()
  })

  it('renders all six SET-1 fields with Ji-default values after hydration', async () => {
    renderSettings()

    await screen.findByText('Default RIR')
    expect(screen.getByText('0')).toBeInTheDocument() // RIR
    expect(screen.getByText('3:00')).toBeInTheDocument() // rest
    expect(screen.getByText('2')).toBeInTheDocument() // warm-ups
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Mon' })).toHaveAttribute('aria-checked', 'true')
  })

  it('persists Default RIR changes to the Dexie settings row', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByText('Default RIR')

    await user.click(screen.getByRole('button', { name: 'Increase default RIR' }))
    await waitFor(async () => {
      expect((await settingsRepo.get())?.defaultRir).toBe(1)
    })
  })

  it('persists Default rest changes to the Dexie settings row', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByText('Default rest')

    await user.click(screen.getByRole('button', { name: 'Increase default rest' }))
    await waitFor(async () => {
      expect((await settingsRepo.get())?.defaultRestSeconds).toBe(195)
    })
  })

  it('persists Warm-up sets changes to the Dexie settings row', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByText('Warm-up sets')

    await user.click(screen.getByRole('button', { name: 'Increase warm-up sets' }))
    await waitFor(async () => {
      expect((await settingsRepo.get())?.defaultWarmupSetCount).toBe(3)
    })
  })

  it('persists Units changes to the Dexie settings row', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('radio', { name: 'lb' })

    await waitFor(async () => {
      await user.click(screen.getByRole('radio', { name: 'lb' }))
      expect((await settingsRepo.get())?.unit).toBe('lb')
    })
  })

  it('persists Theme changes to the Dexie settings row and toggles .dark immediately', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('radio', { name: 'Dark' })

    await waitFor(async () => {
      await user.click(screen.getByRole('radio', { name: 'Dark' }))
      expect(isDark()).toBe(true)
      expect((await settingsRepo.get())?.theme).toBe('dark')
    })
  })

  it('persists Week starts on changes to the Dexie settings row', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('radio', { name: 'Sun' })

    await waitFor(async () => {
      await user.click(screen.getByRole('radio', { name: 'Sun' }))
      expect((await settingsRepo.get())?.weekStartsOn).toBe('sun')
    })
  })

  it('disables the Default RIR decrement at the lower bound (default 0)', async () => {
    renderSettings()
    await screen.findByText('Default RIR')

    // RIR seeds at 0 (min), so it cannot be driven below zero.
    expect(screen.getByRole('button', { name: 'Decrease default RIR' })).toBeDisabled()
  })

  it('disables the Default rest decrement at the lower bound (30s)', async () => {
    // Seed the persisted row at the rest minimum before the provider hydrates.
    await settingsRepo.getOrInit()
    await settingsRepo.update({ defaultRestSeconds: 30 })

    renderSettings()
    await screen.findByText('Default rest')

    expect(screen.getByText('0:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease default rest' })).toBeDisabled()
  })

  it('does not render any backup/sync/export/erase content', async () => {
    renderSettings()
    await screen.findByText('Default RIR')

    for (const forbidden of [/backup/i, /sync/i, /export/i, /erase/i, /import/i]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument()
    }
  })
})
