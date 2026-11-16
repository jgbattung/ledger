import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { SessionAddPickerPage } from '@/routes/SessionAddPickerPage'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { useSessionStore } from '@/stores/sessionStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'

const store = () => useSessionStore.getState()
type User = ReturnType<typeof userEvent.setup>

async function openAddPicker() {
  const programId = await seedProgram('PPL', [
    { name: 'Push', ids: ['barbell-bench-press', 'pull-up'] },
  ])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
  const router = createMemoryRouter(
    [
      { path: '/session', element: <p>Session</p> },
      { path: '/session/add', element: <SessionAddPickerPage /> },
    ],
    { initialEntries: ['/session', '/session/add'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** One paste instead of per-key typing: the picker renders the whole catalog. */
async function narrowTo(user: User, text: string) {
  await user.click(await screen.findByRole('searchbox'))
  await user.paste(text)
}

const BARBELL_CURL = /^Select Barbell Curl(?!s)/

// Each row is a link plus a button over the whole catalog: under a loaded full run the default 5s is tight.
vi.setConfig({ testTimeout: 20_000 })

describe('SessionAddPickerPage', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
    await resetAndHydrateCustomExercises()
  })

  it('titles the page with the workout, has a top Back and no footer without a selection', async () => {
    await openAddPicker()
    expect(await screen.findByRole('heading', { name: 'Add to Push' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New exercise' })).toHaveAttribute(
      'href',
      '/exercises/new?pick=session',
    )
    expect(screen.queryByRole('button', { name: /^Add \d/ })).not.toBeInTheDocument()
  })

  it('disables exercises already in the workout with a hint but keeps their link', async () => {
    const user = userEvent.setup()
    await openAddPicker()
    await narrowTo(user, 'barbell bench press')
    const link = await screen.findByRole('link', { name: /^Barbell Bench Press/ })
    expect(within(link).getByText('Already in this workout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select Barbell Bench Press' })).toBeDisabled()
  })

  it('shows the footer with a numbered pick, the position row and a pluralised button', async () => {
    const user = userEvent.setup()
    await openAddPicker()
    await narrowTo(user, 'curl')
    await user.click(await screen.findByRole('button', { name: BARBELL_CURL }))
    expect(screen.getByRole('button', { name: 'Add 1 exercise' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Select Cable Hammer Curl/ }))
    expect(screen.getByRole('button', { name: 'Add 2 exercises' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Add At the end/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Deselect Cable Hammer Curl/ })).toHaveTextContent('2')
  })

  it('keeps the selection when the search changes', async () => {
    const user = userEvent.setup()
    await openAddPicker()
    await narrowTo(user, 'curl')
    await user.click(await screen.findByRole('button', { name: BARBELL_CURL }))
    await user.clear(screen.getByRole('searchbox'))
    await user.paste('squat')
    expect(await screen.findByRole('button', { name: 'Add 1 exercise' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Selected exercises' })).getByText('Barbell Curl'),
    ).toBeInTheDocument()
  })

  it('adds once on a double tap and goes back', async () => {
    const user = userEvent.setup()
    const router = await openAddPicker()
    await narrowTo(user, 'curl')
    await user.click(await screen.findByRole('button', { name: BARBELL_CURL }))
    await user.dblClick(screen.getByRole('button', { name: 'Add 1 exercise' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    const ids = store().exercises.map((e) => e.exercise.exerciseRef.exerciseId)
    expect(ids).toEqual(['barbell-bench-press', 'pull-up', 'barbell-curl'])
    expect(store().addSelection).toEqual([])
  })

  it('Back adds nothing and clears the picks', async () => {
    const user = userEvent.setup()
    const router = await openAddPicker()
    await narrowTo(user, 'curl')
    await user.click(await screen.findByRole('button', { name: BARBELL_CURL }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    expect(store().addSelection).toEqual([])
    expect(store().exercises).toHaveLength(2)
  })

  it('consumes a pending pick into the selection', async () => {
    useCustomExerciseFormStore.getState().setPendingPick({ source: 'db', exerciseId: 'barbell-curl' })
    await openAddPicker()
    await waitFor(() => expect(store().addSelection).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Add 1 exercise' })).toBeInTheDocument()
  })

  it('redirects to the session when no workout is in progress', async () => {
    const router = createMemoryRouter(
      [
        { path: '/session', element: <p>Session</p> },
        { path: '/session/add', element: <SessionAddPickerPage /> },
      ],
      { initialEntries: ['/session/add'] },
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
  })

  describe('position sheet', () => {
    async function selectOne(user: User) {
      await narrowTo(user, 'curl')
      await user.click(await screen.findByRole('button', { name: BARBELL_CURL }))
    }

    it('lists every slot in workout order with progress and updates the footer', async () => {
      const user = userEvent.setup()
      await openAddPicker()
      await selectOne(user)
      await user.click(screen.getByRole('button', { name: /^Add At the end/ }))
      const sheet = await screen.findByRole('dialog', { name: 'Where should they go?' })
      expect(within(sheet).getByText('Added in the order you picked them.')).toBeInTheDocument()
      const rows = within(sheet)
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('aria-pressed'))
      expect(rows.map((row) => row.textContent)).toEqual([
        'At the start',
        'After Barbell Bench PressCurrent · Not started',
        'After Pull-UpNot started',
        'At the end',
      ])
      expect(within(sheet).getByRole('button', { name: 'At the end' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await user.click(within(sheet).getByRole('button', { name: /^After Barbell Bench Press/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: /^Add After Barbell Bench Press/ })).toBeInTheDocument()
      // Nothing is written until Add.
      expect(store().exercises).toHaveLength(2)
    })

    it('Add inserts after the chosen exercise', async () => {
      const user = userEvent.setup()
      await openAddPicker()
      await selectOne(user)
      await user.click(screen.getByRole('button', { name: /^Add At the end/ }))
      await user.click(await screen.findByRole('button', { name: /^After Barbell Bench Press/ }))
      await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }))
      await waitFor(() => expect(store().exercises).toHaveLength(3))
      expect(store().exercises.map((e) => e.exercise.exerciseRef.exerciseId)).toEqual([
        'barbell-bench-press',
        'barbell-curl',
        'pull-up',
      ])
    })

    it('At the start shows in the footer', async () => {
      const user = userEvent.setup()
      await openAddPicker()
      await selectOne(user)
      await user.click(screen.getByRole('button', { name: /^Add At the end/ }))
      await user.click(await screen.findByRole('button', { name: 'At the start' }))
      expect(screen.getByRole('button', { name: /^Add At the start/ })).toBeInTheDocument()
    })
  })
})
