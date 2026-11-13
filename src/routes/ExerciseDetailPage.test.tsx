import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'
import { getExerciseById } from '@/exercises/catalog'
import { ExerciseDetailPage } from '@/routes/ExerciseDetailPage'

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/more/library', element: <p>Library page</p> },
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
})
