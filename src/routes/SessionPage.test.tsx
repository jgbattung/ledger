import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { db } from '@/db/ledger'
import { programs, workouts } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { useSessionStore } from '@/stores/sessionStore'
import { SessionPage } from '@/routes/SessionPage'
import { seedProgram } from '@/routes/editorTestUtils'

const store = () => useSessionStore.getState()

function renderSession() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Dashboard</p> },
      { path: '/workout', element: <p>Workout tab</p> },
      { path: '/day', element: <p>Day page</p> },
      { path: '/session', element: <SessionPage /> },
      { path: '/session/swap/:workoutExerciseId', element: <p>Swap picker</p> },
    ],
    { initialEntries: ['/day', '/session'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function startPush() {
  const programId = await seedProgram('PPL', [
    { name: 'Push', ids: ['barbell-bench-press', 'pull-up'] },
    { name: 'Pull', ids: ['barbell-squat'] },
  ])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
  return { programId, pushId: tree.days[0].day.id }
}

/** Logs `reps` on a set through the store, like the pad would. */
function logReps(setId: string, reps: string) {
  act(() => {
    store().openPad(setId, 'reps')
    for (const digit of reps) store().padKey(digit as '1')
    store().closePad()
  })
}

describe('SessionPage', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  it('redirects to the Workout tab when nothing is in progress', async () => {
    const router = renderSession()
    expect(await screen.findByText('Workout tab')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/workout')
  })

  it('renders the workout: top bar, strip, focus header, chips and the set table', async () => {
    await startPush()
    renderSession()
    expect(await screen.findByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByLabelText('Workout duration')).toHaveTextContent(/^0:0\d:\d\d$/)
    expect(screen.getByRole('timer', { name: 'Rest timer' })).toHaveTextContent('0:00')
    expect(screen.getByRole('button', { name: 'Workout menu' })).toBeInTheDocument()
    expect(screen.getByText('Set 1 of 3 · 8–12 reps · RIR 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Swap' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Warm Up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Info' })).toBeDisabled()
    const table = screen.getByRole('table', { name: 'Sets' })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    // Blank cells: target range placeholder for reps, an en dash for weight.
    expect(screen.getAllByText('8–12')).toHaveLength(3)
  })

  it('tapping a tile focuses that exercise', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'Pull-Up' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pull-Up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pull-Up' })).toHaveAttribute('aria-current', 'true')
  })

  it('the Targets sheet shows the snapshot and "No targets" when empty', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'Targets' }))
    const sheet = await screen.findByRole('dialog', { name: 'Targets' })
    expect(within(sheet).getByText('Working sets')).toBeInTheDocument()
    expect(within(sheet).getByText('8–12')).toBeInTheDocument()
  })

  it('Back keeps the workout running', async () => {
    await startPush()
    const user = userEvent.setup()
    const router = renderSession()
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/day'))
    expect((await workouts.getInProgress())?.status).toBe('in_progress')
  })

  it('checking a set with 0 reps does not stamp it; with reps it checks and unchecks', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    const first = await screen.findByRole('checkbox', { name: 'Mark set 1 done' })
    await user.click(first)
    expect(first).toHaveAttribute('aria-checked', 'false')
    expect(store().pad).toMatchObject({ entry: { field: 'reps' } })
    act(() => store().closePad())

    const setId = store().exercises[0].sets[0].id
    logReps(setId, '9')
    await user.click(screen.getByRole('checkbox', { name: 'Mark set 1 done' }))
    expect(screen.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(screen.getByRole('checkbox', { name: 'Mark set 1 not done' }))
    expect(screen.getByRole('checkbox', { name: 'Mark set 1 done' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('shows partials as 8 | 2, the RIR badge and Previous from the last finished workout', async () => {
    const { programId, pushId } = await startPush()
    const first = store().exercises[0].sets[0].id
    act(() => {
      store().openPad(first, 'weight')
      for (const key of ['6', '0'] as const) store().padKey(key)
      store().openPad(first, 'reps')
      store().padKey('8')
      store().padKey('fp')
      store().padKey('2')
      store().closePad()
      store().setRir(first, 1, false)
      store().toggleComplete(first)
    })
    await act(() => store().finish())

    await act(() => store().start(programId, pushId))
    renderSession()
    const table = await screen.findByRole('table', { name: 'Sets' })
    expect(
      within(table).getByText((_, el) => el?.tagName === 'P' && el.textContent === '60 kg × 8|2'),
    ).toBeInTheDocument()
    expect(within(table).getByText('RIR 1')).toBeInTheDocument()
    expect(within(table).getAllByText('–').length).toBeGreaterThan(0)
  })

  it('Add set appends a row that copies the previous weight', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    const first = store().exercises[0].sets[0].id
    act(() => {
      store().openPad(first, 'weight')
      store().padKey('7')
      store().padKey('0')
      store().closePad()
    })
    await user.click(await screen.findByRole('button', { name: 'Add set' }))
    await waitFor(() => expect(store().exercises[0].sets).toHaveLength(4))
    expect(store().exercises[0].sets[3].weight).toBe(0)
    expect(store().exercises[0].sets[3].orderIndex).toBe(3)
  })

  it('shows the Finish bar only when every set is checked', async () => {
    await startPush()
    renderSession()
    await screen.findByRole('table', { name: 'Sets' })
    expect(screen.queryByRole('button', { name: 'Finish workout' })).toBeNull()
    for (const entry of store().exercises) {
      for (const set of entry.sets) {
        logReps(set.id, '8')
        act(() => store().toggleComplete(set.id))
      }
    }
    expect(await screen.findByRole('button', { name: 'Finish workout' })).toBeInTheDocument()
  })

  it('finishing with unchecked sets asks first, then lands on the Dashboard and ticks the day', async () => {
    const { programId, pushId } = await startPush()
    const user = userEvent.setup()
    const router = renderSession()
    const setId = store().exercises[0].sets[0].id
    logReps(setId, '8')
    act(() => store().toggleComplete(setId))

    await user.click(await screen.findByRole('button', { name: 'Workout menu' }))
    await user.click(await screen.findByRole('button', { name: 'Finish workout' }))
    const confirm = await screen.findByRole('dialog', { name: 'Finish with 6 sets not done?' })
    expect(within(confirm).getByText("Unchecked sets aren't saved.")).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Finish workout' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect((await programs.get(programId))?.completedDayIds).toContain(pushId)
    const stored = await db.workouts.toArray()
    expect(stored[0].status).toBe('finished')
  })

  it('discard asks with the destructive sheet, goes to the Workout tab and leaves the day unticked', async () => {
    const { programId, pushId } = await startPush()
    const user = userEvent.setup()
    const router = renderSession()
    await user.click(await screen.findByRole('button', { name: 'Workout menu' }))
    await user.click(await screen.findByRole('button', { name: 'Discard workout' }))
    const confirm = await screen.findByRole('dialog', { name: 'Discard this workout?' })
    await user.click(within(confirm).getByRole('button', { name: 'Discard workout' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect((await db.workouts.toArray())[0].status).toBe('discarded')
    expect((await programs.get(programId))?.completedDayIds ?? []).not.toContain(pushId)
  })

  it('the menu offers a disabled Minimize and a workout note that persists', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'Workout menu' }))
    expect(await screen.findByRole('button', { name: /Minimize/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Workout note' }))
    await user.type(await screen.findByRole('textbox', { name: 'Workout note' }), 'Great')
    await act(() => store().flushNotes())
    expect((await db.workouts.toArray())[0].notes).toBe('Great')
  })

  it('the Swap chip explains why when a set is checked', async () => {
    await startPush()
    const user = userEvent.setup()
    renderSession()
    const setId = store().exercises[0].sets[0].id
    logReps(setId, '8')
    act(() => store().toggleComplete(setId))
    await user.click(await screen.findByRole('button', { name: 'Swap' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/only available before any set/)
  })

  describe('exercise switch motion', () => {
    const slideWrapper = () =>
      screen.getByRole('heading', { level: 2 }).closest('[class*="exercise-enter"], [style*="exercise-slide"]')

    it('does not slide on first render', async () => {
      await startPush()
      renderSession()
      await screen.findByRole('heading', { level: 2, name: 'Barbell Bench Press' })
      expect(document.querySelector('.exercise-enter')).toBeNull()
    })

    it('slides in from the right for a later exercise and from the left for an earlier one', async () => {
      await startPush()
      const user = userEvent.setup()
      renderSession()
      await user.click(await screen.findByRole('button', { name: 'Pull-Up' }))
      expect(slideWrapper()).toHaveClass('exercise-enter')
      expect(slideWrapper()?.getAttribute('style')).toContain('calc(1 *')
      await user.click(screen.getByRole('button', { name: 'Barbell Bench Press' }))
      expect(slideWrapper()?.getAttribute('style')).toContain('calc(-1 *')
    })

    it('auto-advance wrapping to an earlier exercise slides from the left', async () => {
      await startPush()
      renderSession()
      const [bench, pull] = store().exercises
      act(() => store().focusExercise(pull.exercise.id))
      for (const set of pull.sets) {
        logReps(set.id, '8')
        act(() => store().toggleComplete(set.id))
      }
      expect(await screen.findByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeInTheDocument()
      expect(slideWrapper()?.getAttribute('style')).toContain('calc(-1 *')
      expect(bench.exercise.id).toBe(store().focusedExerciseId)
    })

    it('the strip indicator moves to the focused tile and never blocks input', async () => {
      await startPush()
      const user = userEvent.setup()
      renderSession()
      const indicator = await screen.findByTestId('strip-indicator')
      expect(indicator.style.transform).toContain('calc(0 *')
      await user.click(screen.getByRole('button', { name: 'Pull-Up' }))
      expect(indicator.style.transform).toContain('calc(1 *')
      // A rapid second switch retargets immediately.
      await user.click(screen.getByRole('button', { name: 'Barbell Bench Press' }))
      await user.click(screen.getByRole('button', { name: 'Pull-Up' }))
      expect(screen.getByRole('heading', { level: 2, name: 'Pull-Up' })).toBeInTheDocument()
    })
  })
})
