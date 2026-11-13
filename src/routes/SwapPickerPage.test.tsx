import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { db } from '@/db/ledger'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { SwapPickerPage } from '@/routes/SwapPickerPage'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { useSessionStore } from '@/stores/sessionStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'

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
    await resetAndHydrateCustomExercises()
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

  const ssbInput = {
    name: 'SSB Squat',
    primaryMuscles: ['quads' as const],
    secondaryMuscles: [],
    mechanic: 'compound' as const,
  }

  it('swaps to a custom exercise with the custom ref', async () => {
    const created = await useCustomExerciseStore.getState().create(ssbInput)
    const { router, bench } = await startAndOpenSwap()
    const user = userEvent.setup()
    await search(user, 'ssb squat')
    await user.click(await screen.findByRole('button', { name: /^SSB Squat/ }))
    const sheet = await screen.findByRole('dialog', { name: /Swap to SSB Squat/ })
    await user.click(within(sheet).getByRole('button', { name: /Reset/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    const stored = await db.workoutExercises.get(bench)
    expect(stored?.exerciseRef).toEqual({ source: 'custom', exerciseId: created.id })
  })

  it('disables a custom exercise already in the workout', async () => {
    const created = await useCustomExerciseStore.getState().create(ssbInput)
    const programId = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
    const tree = (await programs.loadTree(programId))!
    await store().start(programId, tree.days[0].day.id)
    const first = store().exercises[0].exercise.id
    await store().swap(first, { source: 'custom', exerciseId: created.id }, 'reset')
    const router = createMemoryRouter(
      [
        { path: '/session', element: <p>Session</p> },
        { path: '/session/swap/:workoutExerciseId', element: <SwapPickerPage /> },
      ],
      { initialEntries: ['/session', `/session/swap/${first}`], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    const user = userEvent.setup()
    await search(user, 'ssb squat')
    expect(await screen.findByRole('button', { name: /^SSB Squat/ })).toBeDisabled()
  })

  it('does not list a deleted custom exercise', async () => {
    const created = await useCustomExerciseStore.getState().create(ssbInput)
    await useCustomExerciseStore.getState().remove(created.id)
    await startAndOpenSwap()
    const user = userEvent.setup()
    await search(user, 'ssb squat')
    expect(await screen.findByRole('link', { name: 'Create "ssb squat"' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^SSB Squat/ })).toBeNull()
  })

  it('has a + for this picker and an empty-state Create with the query', async () => {
    await startAndOpenSwap()
    const user = userEvent.setup()
    expect(await screen.findByRole('link', { name: 'New exercise' })).toHaveAttribute(
      'href',
      '/exercises/new?pick=swap',
    )
    await search(user, 'zzqqxx')
    expect(await screen.findByRole('link', { name: 'Create "zzqqxx"' })).toHaveAttribute(
      'href',
      '/exercises/new?pick=swap&name=zzqqxx',
    )
  })

  it('consumes a pending pick and opens the Keep / Reset sheet for it', async () => {
    const created = await useCustomExerciseStore.getState().create(ssbInput)
    useCustomExerciseFormStore.getState().setPendingPick({ source: 'custom', exerciseId: created.id })
    await startAndOpenSwap()
    expect(await screen.findByRole('dialog', { name: /Swap to SSB Squat/ })).toBeInTheDocument()
    expect(useCustomExerciseFormStore.getState().pendingPick).toBeNull()
  })
})
