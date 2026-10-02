import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { programs, workouts } from '@/db/repos'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { ProgramEditorPage } from './ProgramEditorPage'
import { ExercisePickerPage } from './ExercisePickerPage'
import { renderEditor, seedProgram } from './editorTestUtils'

const ONE_DAY = [{ name: 'Push', ids: ['pull-up'] }]
const sevenDays = Array.from({ length: 7 }, (_, i) => ({ name: `D${i + 1}`, ids: ['pull-up'] }))

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Program settings' }))
  return screen.findByRole('dialog', { name: 'Program settings' })
}

describe('ProgramEditorPage - settings drawer', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  it('renders the rows in order; the Soon rows are disabled', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    const labels = within(sheet)
      .getAllByRole('button')
      .map((b) => b.textContent?.replace('Soon', '').trim())
      .filter((t) => t && t !== '')
    expect(labels).toEqual([
      'NamePPL',
      'Notes',
      'Number of cycles',
      'Day order',
      'Duplicate program',
      'Deactivate program',
      'Archive program',
      'Delete program',
    ])
    for (const name of ['Number of cycles', 'Day order', 'Duplicate program']) {
      expect(within(sheet).getByRole('button', { name: `${name} Soon` })).toBeDisabled()
    }
  })

  it('reads "Number of weeks" for a 7-day draft', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('Week', sevenDays)
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    expect(within(sheet).getByText('Number of weeks')).toBeInTheDocument()
  })

  it('hides Deactivate on an inactive program', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    expect(within(sheet).queryByText('Deactivate program')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Archive program')).toBeInTheDocument()
  })

  it('a new program hides Deactivate, Archive and Delete', async () => {
    const user = userEvent.setup()
    renderEditor('/programs/new')
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    const sheet = await openSettings(user)
    for (const name of ['Deactivate program', 'Archive program', 'Delete program']) {
      expect(within(sheet).queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('Name edits the title through the draft', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: /^Name/ }))
    const field = await screen.findByLabelText('Name')
    await user.clear(field)
    await user.type(field, 'Upper Lower{Enter}')
    expect(screen.getByRole('heading', { name: 'Upper Lower' })).toBeInTheDocument()
  })

  it('Deactivate flips the flag and does not make the draft dirty', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Deactivate program' }))
    await waitFor(async () => expect((await programs.get(id))?.isActive).toBe(false))
    // Inactive now: Save + Activate pair is shown and Save is still disabled (clean).
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Archive of the active program confirms, then archives and leaves', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Archive PPL?' })
    await user.click(within(confirm).getByRole('button', { name: 'Archive program' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(await programs.get(id)).toMatchObject({ isArchived: true, isActive: false })
  })

  it('Restore un-archives', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('Old', ONE_DAY, { archive: true })
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    expect(within(sheet).queryByText('Archive program')).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Restore program' }))
    await waitFor(async () => expect((await programs.get(id))?.isArchived).toBe(false))
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('Delete removes the program from listLive and leaves a finished workout intact', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const tree = await programs.loadTree(id)
    const workout = await workouts.create({
      programId: id,
      programDayId: tree!.days[0].day.id,
      name: 'Push',
      startedAt: 1,
      finishedAt: 2,
      status: 'finished',
    })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete PPL?' })
    expect(within(confirm).getByText(/active program/)).toBeInTheDocument()
    expect(within(confirm).getByText(/stay in your history/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Delete program' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(await programs.listLive()).toHaveLength(0)
    expect(await workouts.get(workout.id)).toEqual(workout)
  })
})

describe('ProgramEditorPage - unsaved-changes guard', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  async function openEditor() {
    const id = await seedProgram('PPL', ONE_DAY)
    const router = createMemoryRouter(
      [
        { path: '/workout', element: <p>Workout tab</p> },
        { path: '/programs/:programId', element: <ProgramEditorPage /> },
        { path: '/programs/:programId/exercises', element: <ExercisePickerPage /> },
      ],
      { initialEntries: ['/workout', `/programs/${id}`], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('tablist')
    return router
  }

  it('back from a dirty editor shows Discard changes; Keep editing stays', async () => {
    const user = userEvent.setup()
    const router = await openEditor()
    await user.type(screen.getByLabelText('Day notes'), 'x')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const sheet = await screen.findByRole('dialog', { name: 'Discard changes?' })
    await user.click(within(sheet).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toMatch(/^\/programs\//)
  })

  it('Discard leaves and drops the draft', async () => {
    const user = userEvent.setup()
    const router = await openEditor()
    await user.type(screen.getByLabelText('Day notes'), 'x')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const sheet = await screen.findByRole('dialog', { name: 'Discard changes?' })
    await user.click(within(sheet).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(useProgramDraftStore.getState().draft).toBeNull()
  })

  it('a system back (history pop) is guarded too', async () => {
    const user = userEvent.setup()
    const router = await openEditor()
    await user.type(screen.getByLabelText('Day notes'), 'x')
    await router.navigate(-1)
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument()
  })

  it('Add exercises is not blocked', async () => {
    const user = userEvent.setup()
    const router = await openEditor()
    await user.type(screen.getByLabelText('Day notes'), 'x')
    await user.click(screen.getByRole('link', { name: 'Add exercises' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/exercises$/))
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument()
  })

  it('a clean editor leaves without prompting', async () => {
    const user = userEvent.setup()
    const router = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
