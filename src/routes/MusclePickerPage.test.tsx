import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { CustomExerciseFormPage } from '@/routes/CustomExerciseFormPage'
import { MusclePickerPage } from '@/routes/MusclePickerPage'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'

const form = () => useCustomExerciseFormStore.getState()

function renderFlow(path = '/exercises/new') {
  const router = createMemoryRouter(
    [
      { path: '/start', element: <p>Start page</p> },
      { path: '/exercises/new', element: <CustomExerciseFormPage /> },
      { path: '/exercises/new/muscles', element: <MusclePickerPage /> },
    ],
    { initialEntries: ['/start', path], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

async function openPrimary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Primary/ }))
  await screen.findByRole('heading', { name: 'Primary muscles' })
}

describe('MusclePickerPage', () => {
  beforeEach(async () => {
    await resetDb()
    form().reset()
    await resetAndHydrateCustomExercises()
  })

  it('Next is disabled with no primary and enabled once one is picked', async () => {
    const user = userEvent.setup()
    renderFlow()
    await openPrimary(user)
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(tile('Chest'))
    expect(tile('Chest')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('the switch shows the lower half and counts picks in each half', async () => {
    const user = userEvent.setup()
    renderFlow()
    await openPrimary(user)
    // Upper body is the opening half.
    expect(screen.getByRole('heading', { name: 'Chest' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Quads/ })).toBeNull()
    await user.click(screen.getByRole('radio', { name: /Lower body/ }))
    expect(screen.queryByRole('button', { name: /^Chest/ })).toBeNull()
    await user.click(tile('Quads'))
    await user.click(screen.getByRole('radio', { name: /Upper body/ }))
    await user.click(tile('Chest'))
    // Each half now shows its own pick count.
    expect(screen.getByRole('radio', { name: 'Upper body 1 selected' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lower body 1 selected' })).toBeInTheDocument()
  })

  it('on step 2 a primary is disabled with a P badge and a secondary shows S', async () => {
    const user = userEvent.setup()
    renderFlow()
    await openPrimary(user)
    await user.click(screen.getByRole('radio', { name: /Lower body/ }))
    await user.click(tile('Quads'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Secondary muscles' })
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Lower body/ }))
    expect(tile('Quads')).toBeDisabled()
    expect(within(tile('Quads')).getByText('P')).toBeInTheDocument()
    await user.click(tile('Glutes'))
    expect(within(tile('Glutes')).getByText('S')).toBeInTheDocument()
    expect(form().draft.secondaryMuscles).toEqual(['glutes'])
  })

  it('Back on step 2 returns to step 1', async () => {
    const user = userEvent.setup()
    const router = renderFlow()
    await openPrimary(user)
    await user.click(tile('Chest'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Secondary muscles' })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('heading', { name: 'Primary muscles' })
    expect(router.state.location.search).toBe('?step=primary')
  })

  it('Done with no secondary returns to the form with the primary in its row, and history skips the steps', async () => {
    const user = userEvent.setup()
    const router = renderFlow()
    await openPrimary(user)
    await user.click(tile('Chest'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Secondary muscles' })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('heading', { name: 'New exercise' })
    const row = screen.getByRole('button', { name: /Primary/ })
    expect(row).toHaveTextContent('Chest')
    expect(router.state.location.pathname).toBe('/exercises/new')

    // History Back from the form leaves the form instead of reopening a step.
    await user.click(screen.getByRole('button', { name: 'Back' }))
    // The form is dirty, so it asks first.
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
  })

  it('a filled row opens its own step directly, and Done needs a primary on step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    await openPrimary(user)
    await user.click(tile('Chest'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await user.click(await screen.findByRole('button', { name: /Primary/ }))
    await screen.findByRole('heading', { name: 'Primary muscles' })
    // Direct entry: Done, not Next.
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    await user.click(tile('Chest'))
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  })

  it('opens on the half that holds an existing pick', async () => {
    form().start({ mode: 'new' })
    form().setPrimaryMuscles(['quads'])
    const user = userEvent.setup()
    renderFlow()
    await user.click(await screen.findByRole('button', { name: /Primary/ }))
    await screen.findByRole('heading', { name: 'Primary muscles' })
    expect(tile('Quads')).toHaveAttribute('aria-pressed', 'true')
  })
})
