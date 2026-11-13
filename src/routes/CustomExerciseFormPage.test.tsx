import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { customExercises } from '@/db/repos/customExercises'
import { resetDb } from '@/db/test-utils'
import { CustomExerciseFormPage } from '@/routes/CustomExerciseFormPage'
import { useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'
import App from '@/App'

const form = () => useCustomExerciseFormStore.getState()

function renderForm(path: string, { from = '/start' }: { from?: string | null } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/start', element: <p>Start page</p> },
      { path: '/picker', element: <p>Picker page</p> },
      { path: '/exercises/new', element: <CustomExerciseFormPage /> },
      { path: '/exercises/new/muscles', element: <p>Muscle page</p> },
      { path: '/exercises/custom/:id/edit', element: <CustomExerciseFormPage /> },
      { path: '/exercises/:source/:exerciseId', element: <p>Exercise page</p> },
    ],
    from === null ? { initialEntries: [path] } : { initialEntries: [from, path], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function seedSsb() {
  const row = await customExercises.create({
    name: 'SSB Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipmentTag: 'barbell',
    mechanic: 'compound',
    notes: 'Safety squat bar',
  })
  await resetAndHydrateCustomExercises()
  return row
}

const saveButton = () => screen.getByRole('button', { name: 'Save exercise' })
const valid = () => {
  form().setPrimaryMuscles(['quads'])
  form().setMechanic('compound')
}

describe('CustomExerciseFormPage', () => {
  beforeEach(async () => {
    await resetDb()
    form().reset()
    await resetAndHydrateCustomExercises()
  })

  it('Save with everything empty writes nothing and names every problem', async () => {
    const user = userEvent.setup()
    renderForm('/exercises/new')
    await screen.findByRole('heading', { name: 'New exercise' })
    await user.click(saveButton())
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(screen.getByText('Pick at least one primary muscle.')).toBeInTheDocument()
    expect(screen.getByText('Choose compound or isolation.')).toBeInTheDocument()
    expect(await customExercises.list()).toHaveLength(0)
  })

  it('refuses a bundled name in any case', async () => {
    const user = userEvent.setup()
    renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), 'bARBELL sQuat')
    act(valid)
    await user.click(saveButton())
    expect(await screen.findByText('An exercise with this name already exists.')).toBeInTheDocument()
    expect(await customExercises.list()).toHaveLength(0)
  })

  it('refuses another live custom name', async () => {
    const user = userEvent.setup()
    await seedSsb()
    renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), 'ssb squat')
    act(valid)
    await user.click(saveButton())
    expect(await screen.findByText('An exercise with this name already exists.')).toBeInTheDocument()
  })

  it('a deleted custom exercise frees its name for a new one', async () => {
    const user = userEvent.setup()
    const row = await seedSsb()
    await useCustomExerciseStore.getState().remove(row.id)
    renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), 'SSB Squat')
    act(valid)
    await user.click(saveButton())
    await waitFor(async () => expect(await customExercises.list()).toHaveLength(1))
    expect(screen.queryByText('An exercise with this name already exists.')).toBeNull()
  })

  it('trims the name and stores blank notes as undefined', async () => {
    const user = userEvent.setup()
    renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), '  Zercher Squat  ')
    await user.type(screen.getByLabelText('Notes (optional)'), '   ')
    act(valid)
    await user.click(saveButton())
    await waitFor(async () => expect(await customExercises.list()).toHaveLength(1))
    const [created] = await customExercises.list()
    expect(created.name).toBe('Zercher Squat')
    expect(created.notes).toBeUndefined()
  })

  it('a dirty form opens the muscle page without the discard prompt and keeps the draft', async () => {
    const user = userEvent.setup()
    const router = renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), 'Zerc')
    await user.click(screen.getByRole('button', { name: /^Primary/ }))
    expect(await screen.findByText('Muscle page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/exercises/new/muscles')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(form().draft.name).toBe('Zerc')
  })

  it('an exercise may keep its own name when edited', async () => {
    const user = userEvent.setup()
    const row = await seedSsb()
    const router = renderForm(`/exercises/custom/${row.id}/edit`, { from: `/exercises/custom/${row.id}` })
    await screen.findByRole('heading', { name: 'Edit exercise' })
    await user.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/custom/${row.id}`))
  })

  it('a valid New save creates the row and lands on its page, replacing the form', async () => {
    const user = userEvent.setup()
    const router = renderForm('/exercises/new?name=Zercher%20Squat')
    expect(await screen.findByLabelText('Name')).toHaveValue('Zercher Squat')
    act(valid)
    await user.click(saveButton())
    const [created] = await customExercises.list()
    expect(created.name).toBe('Zercher Squat')
    expect(created.mechanic).toBe('compound')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/custom/${created.id}`))
    expect(await screen.findByText('Exercise page')).toBeInTheDocument()
    // Replaced: Back goes to where the user started, not to the form.
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/start')
  })

  it('from a picker, Save sets the pending pick and returns to it', async () => {
    const user = userEvent.setup()
    const router = renderForm('/exercises/new?pick=program&name=ssb%20squat', { from: '/picker' })
    await screen.findByLabelText('Name')
    act(valid)
    await user.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe('/picker'))
    expect(form().pendingPick).toMatchObject({ source: 'custom' })
  })

  it('Edit saves the changes and returns to the exercise page it was opened from', async () => {
    const user = userEvent.setup()
    const row = await seedSsb()
    const router = renderForm(`/exercises/custom/${row.id}/edit`, { from: `/exercises/custom/${row.id}` })
    const name = await screen.findByLabelText('Name')
    expect(name).toHaveValue('SSB Squat')
    await user.clear(name)
    await user.type(name, 'SSB Box Squat')
    await user.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/custom/${row.id}`))
    expect((await customExercises.get(row.id))?.name).toBe('SSB Box Squat')
    expect(useCustomExerciseStore.getState().byId[row.id].name).toBe('SSB Box Squat')
  })

  it('Edit opened as the first history entry saves and lands on the exercise page', async () => {
    const user = userEvent.setup()
    const row = await seedSsb()
    const router = renderForm(`/exercises/custom/${row.id}/edit`, { from: null })
    expect(router.state.historyAction).toBe('POP')
    await screen.findByRole('heading', { name: 'Edit exercise' })
    await user.type(await screen.findByLabelText('Name'), ' 2')
    await user.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/custom/${row.id}`))
    expect(await screen.findByText('Exercise page')).toBeInTheDocument()
  })

  it('Edit opened from the exercise page: after Save, one Back leaves the exercise page (decision D)', async () => {
    const user = userEvent.setup()
    const row = await seedSsb()
    const router = createMemoryRouter(
      [
        { path: '/start', element: <p>Start page</p> },
        { path: '/exercises/custom/:id/edit', element: <CustomExerciseFormPage /> },
        { path: '/exercises/:source/:exerciseId', element: <p>Exercise page</p> },
      ],
      {
        initialEntries: ['/start', `/exercises/custom/${row.id}`, `/exercises/custom/${row.id}/edit`],
        initialIndex: 2,
      },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { name: 'Edit exercise' })
    await user.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe(`/exercises/custom/${row.id}`))
    // The page the user came from, not a second copy of the exercise page.
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/start')
  })

  it('Edit of an unknown or deleted id shows Exercise not found', async () => {
    const row = await seedSsb()
    await customExercises.softDelete(row.id)
    await resetAndHydrateCustomExercises()
    renderForm(`/exercises/custom/${row.id}/edit`)
    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
  })

  it('leaving dirty prompts; Keep editing stays; Discard leaves', async () => {
    const user = userEvent.setup()
    const router = renderForm('/exercises/new')
    await user.type(await screen.findByLabelText('Name'), 'Zerc')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Discard this exercise?')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.pathname).toBe('/exercises/new')
    expect(screen.getByLabelText('Name')).toHaveValue('Zerc')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
    expect(form().mode).toBeNull()
  })

  it('leaving clean does not prompt and clears the draft', async () => {
    const user = userEvent.setup()
    const router = renderForm('/exercises/new')
    await screen.findByLabelText('Name')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(form().mode).toBeNull()
  })

  it('the equipment sheet sets and clears the value', async () => {
    const user = userEvent.setup()
    renderForm('/exercises/new')
    await screen.findByLabelText('Name')
    await user.click(screen.getByRole('button', { name: 'Equipment: None' }))
    const sheet = await screen.findByRole('dialog')
    // None plus the ten values.
    expect(within(sheet).getAllByRole('button', { name: /^(?!Close)[A-Z]/ })).toHaveLength(11)
    await user.click(within(sheet).getByRole('button', { name: 'Smith Machine' }))
    expect(form().draft.equipmentTag).toBe('smith machine')
    await user.click(await screen.findByRole('button', { name: 'Equipment: Smith Machine' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'None' }))
    expect(form().draft.equipmentTag).toBeUndefined()
  })

  it('Mechanic has no default and can be chosen', async () => {
    const user = userEvent.setup()
    renderForm('/exercises/new')
    await screen.findByLabelText('Name')
    const radios = screen.getAllByRole('radio')
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    await user.click(screen.getByRole('radio', { name: 'Isolation' }))
    expect(form().draft.mechanic).toBe('isolation')
  })
})

describe('custom exercise form routes', () => {
  it('/exercises/new and /exercises/custom/x/edit do not render the detail page', async () => {
    await resetDb()
    form().reset()
    await resetAndHydrateCustomExercises()
    window.history.pushState({}, '', '/exercises/new')
    const first = render(<App />)
    expect(await screen.findByRole('heading', { name: 'New exercise' })).toBeInTheDocument()
    first.unmount()
    form().reset()

    window.history.pushState({}, '', '/exercises/custom/x/edit')
    render(<App />)
    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull()
  })
})
