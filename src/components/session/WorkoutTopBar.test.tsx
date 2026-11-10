import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutTopBar } from '@/components/session/WorkoutTopBar'
import { __resetRestTimerForTests, useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'

const workout = { startedAt: Date.now(), pausedAt: undefined, pausedMs: 0 }

function renderBar(onRestTimer = vi.fn()) {
  render(<WorkoutTopBar workout={workout} onBack={vi.fn()} onMenu={vi.fn()} onRestTimer={onRestTimer} />)
  return onRestTimer
}

describe('WorkoutTopBar rest timer', () => {
  beforeEach(() => {
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: { id: 'w1' } as never })
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetRestTimerForTests()
    useSessionStore.setState({ workout: null })
  })

  it('is a button labelled "not running" when idle, muted 0:00', () => {
    renderBar()
    const button = screen.getByRole('button', { name: 'Rest timer, not running' })
    expect(button).toHaveTextContent('0:00')
    expect(button).toHaveClass('text-muted-foreground')
  })

  it('labels the remaining time while resting', () => {
    renderBar()
    act(() => useRestTimerStore.getState().start(105))
    const button = screen.getByRole('button', { name: 'Rest timer, 1:45 left' })
    expect(button).toHaveTextContent('1:45')
    expect(button).toHaveClass('font-semibold')
  })

  it('drains the 4px track from full to empty, and it is empty when idle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
    const { container } = render(
      <WorkoutTopBar workout={workout} onBack={vi.fn()} onMenu={vi.fn()} onRestTimer={vi.fn()} />,
    )
    const fill = () => container.querySelector<HTMLElement>('[aria-hidden="true"].h-1 > span')!
    expect(fill().style.width).toBe('0%')
    act(() => useRestTimerStore.getState().start(120))
    expect(fill().style.width).toBe('100%')
    act(() => vi.advanceTimersByTime(90_000)) // the hook's 1 s render tick
    expect(fill().style.width).toBe('25%')
    act(() => useRestTimerStore.getState().skip())
    expect(fill().style.width).toBe('0%')
  })

  it('opens the sheet on click, idle or resting', async () => {
    const user = userEvent.setup()
    const onRestTimer = renderBar()
    await user.click(screen.getByRole('button', { name: 'Rest timer, not running' }))
    act(() => useRestTimerStore.getState().start(60))
    await user.click(screen.getByRole('button', { name: /Rest timer, .* left/ }))
    expect(onRestTimer).toHaveBeenCalledTimes(2)
  })
})
