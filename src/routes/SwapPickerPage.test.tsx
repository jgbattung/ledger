import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { db } from '@/db/ledger'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { SwapPickerPage } from '@/routes/SwapPickerPage'
import { useSessionStore } from '@/stores/sessionStore'

const store = () => useSessionStore.getState()

async function startAndOpenSwap() {
  const programId = await seedProgram('PPL', [
    { name: 'Push', ids: ['barbell-bench-press', 'pull-up'] },
  ])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
  const bench = store().exercises[0].exercise.id
  const router = createMemoryRouter(
    [
      { path: '/session', element: <p>Session</p> },
      { path: '/session/swap/:workoutExerciseId', element: <SwapPickerPage /> },
    ],
    { initialEntries: ['/session', `/session/swap/${bench}`], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, bench }
}

async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(await screen.findByRole('searchbox'), text)
}

describe('SwapPickerPage', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  it('disables exercises already in the workout and shows a top Back button', async () => {
    await startAndOpenSwap()
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
    await search(user, 'bench press')
    const inWorkout = await screen.findByRole('button', { name: /^Barbell Bench Press/ })
    expect(inWorkout).toBeDisabled()
    expect(within(inWorkout).getByText('Already in this workout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Dumbbell Bench Press(?! with)/ })).toBeEnabled()
  })

  it('Keep swaps the exercise, keeps the targets and goes back', async () => {
    const { router, bench } = await startAndOpenSwap()
    const user = userEvent.setup()
    await search(user, 'dumbbell bench press')
    await user.click(await screen.findByRole('button', { name: /^Dumbbell Bench Press(?! with)/ }))
    const sheet = await screen.findByRole('dialog', { name: /Swap to Dumbbell Bench Press/ })
    expect(within(sheet).getByText('Replaces Barbell Bench Press for today')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Keep targets · 3 × 8–12/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    const stored = await db.workoutExercises.get(bench)
    expect(stored?.exerciseRef.exerciseId).toBe('dumbbell-bench-press')
    expect(stored?.swappedFrom?.exerciseId).toBe('barbell-bench-press')
    expect(stored?.targetsSnapshot?.repMin).toBe(8)
  })

  it('Reset clears the targets', async () => {
    const { router, bench } = await startAndOpenSwap()
    const user = userEvent.setup()
    await search(user, 'dumbbell bench press')
    await user.click(await screen.findByRole('button', { name: /^Dumbbell Bench Press(?! with)/ }))
    await user.click(await screen.findByRole('button', { name: 'Reset targets' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    expect((await db.workoutExercises.get(bench))?.targetsSnapshot).toBeUndefined()
  })

  it('closing the sheet cancels the swap', async () => {
    const { router, bench } = await startAndOpenSwap()
    const user = userEvent.setup()
    await search(user, 'dumbbell bench press')
    await user.click(await screen.findByRole('button', { name: /^Dumbbell Bench Press(?! with)/ }))
    const sheet = await screen.findByRole('dialog', { name: /Swap to/ })
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.pathname).toBe(`/session/swap/${bench}`)
    expect((await db.workoutExercises.get(bench))?.swappedFrom).toBeUndefined()
  })

  it('Back cancels and returns to the session', async () => {
    const { router } = await startAndOpenSwap()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
  })

  it('redirects to the session when a set is already checked', async () => {
    const programId = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
    const tree = (await programs.loadTree(programId))!
    await store().start(programId, tree.days[0].day.id)
    const first = store().exercises[0].sets[0].id
    act(() => {
      store().openPad(first, 'reps')
      store().padKey('8')
      store().closePad()
      store().toggleComplete(first)
    })
    const router = createMemoryRouter(
      [
        { path: '/session', element: <p>Session</p> },
        { path: '/session/swap/:workoutExerciseId', element: <SwapPickerPage /> },
      ],
      { initialEntries: [`/session/swap/${store().exercises[0].exercise.id}`] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Session')).toBeInTheDocument()
  })
})
