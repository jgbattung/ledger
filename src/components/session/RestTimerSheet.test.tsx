import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RestTimerSheet } from '@/components/session/RestTimerSheet'
import { __resetRestTimerForTests, useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'

const timer = () => useRestTimerStore.getState()

function renderSheet() {
  let open = true
  const onOpenChange = (next: boolean) => {
    open = next
    view.rerender(<RestTimerSheet open={open} onOpenChange={onOpenChange} />)
  }
  const view = render(<RestTimerSheet open onOpenChange={onOpenChange} />)
  return view
}

const strip = () => screen.getByRole('group', { name: 'Rest time presets' })

describe('RestTimerSheet', () => {
  beforeEach(() => {
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: { id: 'w1' } as never, exercises: [] })
  })

  afterEach(() => {
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: null })
  })

  it('renders twelve presets from 0:15 to 3:00 in 15 s steps', () => {
    renderSheet()
    const pills = within(strip()).getAllByRole('button')
    expect(pills).toHaveLength(12)
    expect(pills[0]).toHaveAccessibleName('Rest 0:15')
    expect(pills[0]).toHaveTextContent('0:15')
    expect(pills[11]).toHaveAccessibleName('Rest 3:00')
    expect(pills[5]).toHaveTextContent('1:30')
  })

  it('has a hidden title and no -30 / +30 buttons', () => {
    renderSheet()
    expect(screen.getByRole('dialog', { name: 'Rest timer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^[-+−]\s?30/ })).not.toBeInTheDocument()
  })

  it('shows muted 0:00 and a disabled Skip when idle', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Skip rest' })).toBeDisabled()
    expect(screen.getByText('0:00')).toHaveClass('text-muted-foreground')
  })

  it('tapping a preset while resting restarts at that time and marks it pressed', async () => {
    const user = userEvent.setup()
    timer().start(120)
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Rest 0:45' }))
    expect(timer().totalSeconds).toBe(45)
    expect(Math.round((timer().endsAt! - Date.now()) / 1000)).toBe(45)
    expect(screen.getByRole('button', { name: 'Rest 0:45' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Rest 1:00' })).toHaveAttribute('aria-pressed', 'false')
    // The sheet stays open.
    expect(screen.getByRole('dialog', { name: 'Rest timer' })).toBeInTheDocument()
  })

  it('tapping a preset while idle starts a rest', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Rest 0:30' }))
    expect(timer().endsAt).not.toBeNull()
    expect(timer().totalSeconds).toBe(30)
    expect(await screen.findByRole('button', { name: 'Skip rest' })).toBeEnabled()
  })

  it('Skip ends the rest and closes the sheet', async () => {
    const user = userEvent.setup()
    timer().start(90)
    renderSheet()
    await user.click(screen.getByRole('button', { name: 'Skip rest' }))
    expect(timer().endsAt).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('goes muted 0:00 with Skip disabled when the rest ends, and stays open', () => {
    timer().start(90)
    renderSheet()
    expect(screen.getByText('1:30', { selector: 'div' })).toHaveClass('text-foreground')
    act(() => timer().clear())
    expect(screen.getByRole('button', { name: 'Skip rest' })).toBeDisabled()
    expect(screen.getByText('0:00')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('strip scrolls freely: no snap classes or styles anywhere in it', () => {
    renderSheet()
    const group = strip()
    expect(['', 'none']).toContain(getComputedStyle(group).scrollSnapType)
    for (const el of [group, ...group.querySelectorAll('*')]) {
      expect(el.className.toString()).not.toMatch(/snap/)
      expect((el as HTMLElement).style.scrollSnapType ?? '').toBe('')
      expect((el as HTMLElement).style.scrollSnapAlign ?? '').toBe('')
    }
  })
})
