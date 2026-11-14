import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'
import { getExerciseById } from '@/exercises/catalog'
import { ExerciseDetailPage } from '@/routes/ExerciseDetailPage'

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/more/library', element: <p>Library page</p> },
      { path: '/exercises/new', element: <p>New exercise form</p> },
      { path: '/exercises/custom/:id/edit', element: <p>Edit exercise form</p> },
      { path: '/exercises/:source/:exerciseId', element: <ExerciseDetailPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('ExerciseDetailPage', () => {
  beforeEach(async () => {
    await resetDb()
    await resetAndHydrateCustomExercises()
  })

  it('renders every LIB-5 field of a bundled exercise', async () => {
    const source = getExerciseById('barbell-deadlift')!
    renderPage('/exercises/db/barbell-deadlift')
    expect(await screen.findByRole('heading', { level: 1, name: source.name })).toBeInTheDocument()
    expect(screen.getByText(/^Also known as Conventional Deadlift/)).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Secondary')).toBeInTheDocument()
    expect(screen.getByText('Equipment')).toBeInTheDocument()
    expect(screen.getByText('Strength · Compound')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Instructions' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(source.instructions.length)
    expect(screen.queryByText('Custom')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull()
  })

  it('omits media, secondary muscles, aliases and instructions when the exercise has none', async () => {
    renderPage('/exercises/db/cable-lateral-raise')
    await screen.findByRole('heading', { level: 1, name: 'Cable Lateral Raise' })
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryByText('Secondary')).toBeNull()
    expect(screen.queryByText(/Also known as/)).toBeNull()
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('shows a custom exercise with the Custom pill, equipment tag and Notes', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'Sandbag Carry',
      primaryMuscles: ['forearms'],
      secondaryMuscles: [],
      equipmentTag: 'other',
      notes: 'Hug it high',
    })
    renderPage(`/exercises/custom/${row.id}`)
    await screen.findByRole('heading', { level: 1, name: /Sandbag Carry/ })
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByText('Hug it high')).toBeInTheDocument()
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Instructions' })).toBeNull()
  })

  it('shows Exercise not found with a working Back and no actions button', async () => {
    const router = renderPage('/exercises/db/nope')
    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exercise actions' })).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Library page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/more/library')
  })

  it('switches tabs by click and arrow keys, keeping the choice in the URL', async () => {
    const user = userEvent.setup()
    const router = renderPage('/exercises/db/barbell-deadlift')
    await screen.findByRole('tablist')
    const info = screen.getByRole('tab', { name: 'Info' })
    const history = screen.getByRole('tab', { name: 'History' })
    expect(info).toHaveAttribute('aria-selected', 'true')

    await user.click(history)
    expect(history).toHaveAttribute('aria-selected', 'true')
    expect(info).toHaveAttribute('aria-selected', 'false')
    expect(router.state.location.search).toBe('?tab=history')

    history.focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true')
    expect(router.state.location.search).toBe('')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
  })

  it('only the selected tab points aria-controls at a rendered panel', async () => {
    renderPage('/exercises/db/barbell-deadlift')
    const info = await screen.findByRole('tab', { name: 'Info' })
    const history = screen.getByRole('tab', { name: 'History' })
    expect(info).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id)
    expect(history).not.toHaveAttribute('aria-controls')
  })

  it('shows Exercise not found for an unknown source', async () => {
    renderPage('/exercises/other/x')
    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
  })

  it('opens at the History tab from ?tab=history', async () => {
    renderPage('/exercises/db/barbell-deadlift?tab=history')
    expect(await screen.findByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the actions drawer from the sliders button', async () => {
    const user = userEvent.setup()
    renderPage('/exercises/db/barbell-deadlift')
    await user.click(await screen.findByRole('button', { name: 'Exercise actions' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Rest timer')).toBeInTheDocument()
  })

  describe('Delete and Duplicate', () => {
    const input = {
      name: 'SSB Squat',
      primaryMuscles: ['quads' as const],
      secondaryMuscles: [],
      mechanic: 'compound' as const,
    }

    async function openActions(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Exercise actions' }))
      return screen.findByRole('dialog')
    }

    it('Duplicate on a bundled exercise opens the form prefilled from it', async () => {
      const user = userEvent.setup()
      const router = renderPage('/exercises/db/barbell-squat')
      const drawer = await openActions(user)
      expect(within(drawer).queryByText('Edit exercise')).toBeNull()
      expect(within(drawer).queryByText('Delete exercise')).toBeNull()
      await user.click(within(drawer).getByRole('button', { name: 'Duplicate' }))
      expect(router.state.location.pathname).toBe('/exercises/new')
      expect(router.state.location.search).toBe('?from=db:barbell-squat')
    })

    it('Edit goes to the edit route of a live custom exercise', async () => {
      const user = userEvent.setup()
      const row = await useCustomExerciseStore.getState().create(input)
      const router = renderPage(`/exercises/custom/${row.id}`)
      const drawer = await openActions(user)
      await user.click(within(drawer).getByRole('button', { name: 'Edit exercise' }))
      expect(router.state.location.pathname).toBe(`/exercises/custom/${row.id}/edit`)
    })

    it('Delete names the programs that use it, and the page then shows Deleted with Duplicate only', async () => {
      const user = userEvent.setup()
      const row = await useCustomExerciseStore.getState().create(input)
      const { programs } = await import('@/db/repos')
      const { emptyDraft } = await import('@/programs/model')
      const draft = emptyDraft()
      draft.name = 'PPL-R-UL'
      draft.days = [
        {
          id: crypto.randomUUID(),
          name: 'Legs',
          exercises: [
            {
              id: crypto.randomUUID(),
              exerciseRef: { source: 'custom', exerciseId: row.id },
              workingSets: 3,
              repMin: 8,
              repMax: 12,
            },
          ],
        },
      ]
      await programs.saveTree(draft)

      renderPage(`/exercises/custom/${row.id}`)
      const drawer = await openActions(user)
      await user.click(within(drawer).getByRole('button', { name: 'Delete exercise' }))
      const confirm = await screen.findByRole('dialog', { name: 'Delete SSB Squat?' })
      expect(confirm).toHaveTextContent('It leaves the library and the pickers. Your logged sets are kept.')
      expect(confirm).toHaveTextContent('It stays in 1 program (PPL-R-UL) until you remove it there.')
      await user.click(within(confirm).getByRole('button', { name: 'Delete exercise' }))

      expect(await screen.findByText('Deleted')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      expect(useCustomExerciseStore.getState().byId[row.id].deletedAt).toBeTruthy()
      const after = await openActions(user)
      expect(within(after).getByRole('button', { name: 'Duplicate' })).toBeEnabled()
      expect(within(after).queryByText('Edit exercise')).toBeNull()
      expect(within(after).queryByText('Delete exercise')).toBeNull()
    })

    it('Delete omits the program sentence when nothing uses it', async () => {
      const user = userEvent.setup()
      const row = await useCustomExerciseStore.getState().create(input)
      await seedProgram('Other', [{ name: 'Push', ids: ['barbell-bench-press'] }])
      renderPage(`/exercises/custom/${row.id}`)
      const drawer = await openActions(user)
      await user.click(within(drawer).getByRole('button', { name: 'Delete exercise' }))
      const confirm = await screen.findByRole('dialog', { name: 'Delete SSB Squat?' })
      expect(confirm).not.toHaveTextContent('It stays in')
      await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
      expect(useCustomExerciseStore.getState().byId[row.id].deletedAt).toBeFalsy()
    })
  })
})
