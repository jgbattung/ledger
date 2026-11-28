import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { db } from '@/db/ledger'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { __resetRestTimerForTests } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { SessionPage } from '@/routes/SessionPage'
import { seedProgram } from '@/routes/editorTestUtils'

const store = () => useSessionStore.getState()

function renderSession() {
  const router = createMemoryRouter(
    [
      { path: '/workout', element: <p>Workout tab</p> },
      { path: '/session', element: <SessionPage /> },
      { path: '/session/add', element: <p>Add picker</p> },
    ],
    { initialEntries: ['/workout', '/session'], initialIndex: 1 },
  )
  render(
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>,
  )
  return router
}

async function start(ids: string[]) {
  const programId = await seedProgram('PPL', [{ name: 'Push', ids }])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
}

function logReps(setId: string, reps: string) {
  act(() => {
    store().openPad(setId, 'reps', undefined, 'kg')
    for (const digit of reps) store().padKey(digit as '1')
    store().closePad()
  })
}

describe('session: add tile, More sheet and removing an exercise', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
    __resetRestTimerForTests()
  })

  afterEach(() => __resetRestTimerForTests())

  it('the strip + tile opens the add picker', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    const user = userEvent.setup()
    const router = renderSession()
    await user.click(await screen.findByRole('button', { name: 'Add exercise' }))
    expect(router.state.location.pathname).toBe('/session/add')
  })

  it('More is the last chip and opens the exercise actions sheet', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    const user = userEvent.setup()
    renderSession()
    const more = await screen.findByRole('button', { name: 'More' })
    const chips = screen.getAllByRole('button').filter((b) => ['Swap', 'Targets', 'Info', 'L/R', 'More'].includes(b.textContent ?? ''))
    expect(chips.at(-1)).toBe(more)
    await user.click(more)
    const sheet = await screen.findByRole('dialog', { name: 'Barbell Bench Press' })
    expect(within(sheet).getByText('Changes apply to this workout only.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Remove exercise' })).toBeInTheDocument()
  })

  it('confirms with the no-logged-sets copy, then removes and moves focus to the next exercise', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove Barbell Bench Press?' })
    expect(
      within(confirm).getByText("It's removed from this workout. The program isn't changed."),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Remove exercise' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Pull-Up' })).toBeInTheDocument(),
    )
    expect(store().exercises).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Barbell Bench Press' })).not.toBeInTheDocument()
    expect(await db.workoutExercises.count()).toBe(2)
    expect((await db.workoutExercises.toArray()).filter((r) => r.deletedAt == null)).toHaveLength(1)
  })

  it('uses the logged-sets copy when sets are checked, singular and plural', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    const user = userEvent.setup()
    renderSession()
    await screen.findByRole('heading', { level: 2, name: 'Barbell Bench Press' })
    const [first, second] = store().exercises[0].sets
    logReps(first.id, '8')
    act(() => store().toggleComplete(first.id, 'kg'))
    act(() => store().focusExercise(store().exercises[0].exercise.id))
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    expect(
      await screen.findByText('Its 1 logged set is removed from this workout too.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep exercise' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    logReps(second.id, '8')
    act(() => store().toggleComplete(second.id, 'kg'))
    act(() => store().focusExercise(store().exercises[0].exercise.id))
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    expect(
      await screen.findByText('Its 2 logged sets are removed from this workout too.'),
    ).toBeInTheDocument()
  })

  it('Keep exercise cancels and removes nothing', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    await user.click(await screen.findByRole('button', { name: 'Keep exercise' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(store().exercises).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeInTheDocument()
  })

  it('the only exercise shows a hint instead of the confirm and nothing is removed', async () => {
    await start(['barbell-bench-press'])
    const user = userEvent.setup()
    renderSession()
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'This is the only exercise. To stop, discard the workout from the',
    )
    expect(screen.queryByRole('dialog', { name: /^Remove / })).not.toBeInTheDocument()
    expect(store().exercises).toHaveLength(1)
  })

  it('showing the session discards add-picker picks and resets the position (B1)', async () => {
    await start(['barbell-bench-press', 'pull-up'])
    store().toggleAddPick({ source: 'db', exerciseId: 'barbell-curl' })
    store().setAddPosition({ kind: 'start' })
    renderSession()
    await screen.findByRole('heading', { level: 2, name: 'Barbell Bench Press' })
    expect(store().addSelection).toEqual([])
    expect(store().addPosition).toEqual({ kind: 'end' })
  })

  it('the Targets sheet says an added exercise has no targets in this workout', async () => {
    await start(['barbell-bench-press'])
    await store().addExercises([{ source: 'db', exerciseId: 'barbell-curl' }], { kind: 'end' })
    const user = userEvent.setup()
    renderSession()
    await screen.findByRole('heading', { level: 2, name: 'Barbell Curl' })
    await user.click(screen.getByRole('button', { name: 'Targets' }))
    expect(
      await screen.findByText('No targets for this exercise in this workout.'),
    ).toBeInTheDocument()
  })
})
