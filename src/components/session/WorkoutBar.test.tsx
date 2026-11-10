import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { __resetRestTimerForTests, useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { WorkoutBar } from '@/components/session/WorkoutBar'

const store = () => useSessionStore.getState()

function renderBar() {
  return render(
    <MemoryRouter>
      <WorkoutBar />
    </MemoryRouter>,
  )
}

async function startWorkout() {
  const programId = await seedProgram('PPL', [{ name: 'Push A', ids: ['barbell-bench-press'] }])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
}

describe('WorkoutBar', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
    __resetRestTimerForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetRestTimerForTests()
  })

  it('renders nothing without an in-progress workout', async () => {
    renderBar()
    await waitFor(() => expect(store().hydrated).toBe(true))
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows the name, the clock and set progress, linking to the session', async () => {
    await startWorkout()
    renderBar()
    const link = await screen.findByRole('link', { name: 'Open workout, Push A' })
    expect(link).toHaveAttribute('href', '/session')
    expect(link).toHaveTextContent(/Push A/)
    expect(link).toHaveTextContent(/0:00:0\d/)
    expect(link).toHaveTextContent(/0 of \d+ sets/)
  })

  it('pause dims the clock and swaps the label; resume restores it', async () => {
    await startWorkout()
    renderBar()
    await screen.findByRole('link', { name: 'Open workout, Push A' })
    const clock = () => screen.getByLabelText(/^Workout duration/)
    expect(clock()).toHaveClass('text-foreground')

    await userEvent.click(screen.getByRole('button', { name: 'Pause workout timer' }))
    expect(clock()).toHaveAccessibleName('Workout duration, paused')
    expect(clock()).toHaveClass('text-muted-foreground')
    expect(store().workout?.pausedAt).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Resume workout timer' }))
    expect(clock()).toHaveClass('text-foreground')
    expect(store().workout?.pausedAt).toBeNull()
  })

  it('Stop asks first and Keep workout cancels', async () => {
    await startWorkout()
    renderBar()
    await userEvent.click(await screen.findByRole('button', { name: 'Discard workout' }))
    expect(await screen.findByText('Discard this workout?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep workout' }))
    expect(store().workout).not.toBeNull()
  })

  it('counts a checked set in "N of M sets"', async () => {
    await startWorkout()
    renderBar()
    const link = await screen.findByRole('link', { name: 'Open workout, Push A' })
    const total = store().exercises.flatMap((entry) => entry.sets).length
    expect(link).toHaveTextContent(`0 of ${total} sets`)

    const first = store().exercises[0].sets[0]
    act(() => {
      store().openPad(first.id, 'reps')
      store().padKey('8')
      store().closePad()
      store().toggleComplete(first.id)
    })
    expect(link).toHaveTextContent(`1 of ${total} sets`)
  })

  it('Pause and Stop never navigate; a confirmed Stop leaves you on the current tab', async () => {
    await startWorkout()
    const router = createMemoryRouter([{ path: '*', element: <WorkoutBar /> }], {
      initialEntries: ['/workout'],
    })
    render(<RouterProvider router={router} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Pause workout timer' }))
    await user.click(screen.getByRole('button', { name: 'Resume workout timer' }))
    expect(router.state.location.pathname).toBe('/workout')

    await user.click(screen.getByRole('button', { name: 'Discard workout' }))
    const confirm = await screen.findByRole('dialog', { name: 'Discard this workout?' })
    await user.click(within(confirm).getByRole('button', { name: 'Discard workout' }))
    await waitFor(() => expect(store().workout).toBeNull())
    expect(router.state.location.pathname).toBe('/workout')
  })

  it('confirming discards the workout and hides the bar', async () => {
    await startWorkout()
    renderBar()
    await userEvent.click(await screen.findByRole('button', { name: 'Discard workout' }))
    // Radix hides the bar behind the open sheet, so only the confirm button matches.
    await userEvent.click(await screen.findByRole('button', { name: 'Discard workout' }))
    await waitFor(() => expect(store().workout).toBeNull())
    expect(screen.queryByRole('link', { name: /Open workout/ })).toBeNull()
  })
  describe('rest countdown', () => {
    it('has no rest segment or track when idle', async () => {
      await startWorkout()
      renderBar()
      const link = await screen.findByRole('link', { name: 'Open workout, Push A' })
      expect(link).not.toHaveTextContent(/Rest/)
      expect(screen.queryByTestId('rest-track')).toBeNull()
    })

    it('appends "Rest m:ss" and a draining track while resting, and drops them at the end', async () => {
      await startWorkout()
      renderBar()
      const link = await screen.findByRole('link', { name: 'Open workout, Push A' })
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
      act(() => useRestTimerStore.getState().start(105))

      const segment = await screen.findByLabelText('Rest 1:45 left')
      expect(segment).toHaveTextContent('Rest 1:45')
      expect(segment).toHaveClass('font-semibold', 'text-foreground', 'whitespace-nowrap')
      expect(link).toHaveTextContent(/sets · Rest 1:45/)
      expect(screen.getByTestId('rest-track')).toHaveStyle({ width: '100%' })
      expect(screen.getByTestId('rest-track').parentElement).toHaveAttribute('aria-hidden', 'true')

      // Time passes; the hook's 1 s render tick picks it up.
      vi.setSystemTime(new Date('2026-11-10T10:00:45Z'))
      await waitFor(() => expect(screen.getByLabelText('Rest 1:00 left')).toBeInTheDocument(), {
        timeout: 3000,
      })
      expect(screen.getByTestId('rest-track').style.width).toBe(`${(60 / 105) * 100}%`)

      act(() => useRestTimerStore.getState().skip())
      expect(link).not.toHaveTextContent(/Rest/)
      expect(screen.queryByTestId('rest-track')).toBeNull()
    })
  })
})
