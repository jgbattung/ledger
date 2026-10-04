import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { programs, workouts } from '@/db/repos'
import { selectIsDirty, useProgramDraftStore } from '@/stores/programDraftStore'
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

  async function renameViaSettings(user: ReturnType<typeof userEvent.setup>, name: string) {
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: /^Name/ }))
    const field = await screen.findByLabelText('Name')
    await user.clear(field)
    await user.type(field, name + '{Enter}')
    await screen.findByRole('heading', { name })
  }

  it('Archive of a dirty inactive program saves the edit first and skips both dialogs', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    await renameViaSettings(user, 'Renamed')
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const tree = await programs.loadTree(id)
    expect(tree?.program.name).toBe('Renamed')
    expect(tree?.program.isArchived).toBe(true)
  })

  it('Delete of a dirty program leaves without a Discard changes dialog', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    await renameViaSettings(user, 'Renamed')
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Renamed?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete program' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument()
    expect((await programs.listLive()).map((p) => p.id)).not.toContain(id)
  })

  it('Archive of an inactive program has no Archive confirm', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(screen.queryByRole('dialog', { name: 'Archive PPL?' })).not.toBeInTheDocument()
    expect(await programs.get(id)).toMatchObject({ isArchived: true })
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

  it('Delete of an inactive program does not mention deactivation', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete PPL?' })
    expect(within(confirm).queryByText(/active program/)).not.toBeInTheDocument()
    expect(within(confirm).queryByText(/deactivated/)).not.toBeInTheDocument()
    expect(within(confirm).getByText(/stay in your history/)).toBeInTheDocument()
  })

  async function setNotesViaSettings(user: ReturnType<typeof userEvent.setup>, notes: string) {
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: /^Notes/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Program notes' })
    const field = within(dialog).getByLabelText('Notes')
    await user.clear(field)
    if (notes) await user.type(field, notes)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Program notes' })).not.toBeInTheDocument(),
    )
  }

  it('Notes edits show in the row preview and persist on Save', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    await setNotesViaSettings(user, '6-week block')
    const sheet = await openSettings(user)
    expect(within(sheet).getByRole('button', { name: /^Notes/ })).toHaveTextContent('6-week block')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect((await programs.get(id))?.notes).toBe('6-week block')
  })

  it('clearing notes back to empty leaves the draft clean', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    renderEditor(`/programs/${id}`)
    await setNotesViaSettings(user, 'temp')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await setNotesViaSettings(user, '')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Keep it on the Delete confirm leaves the program live and the editor open', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete PPL?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    expect(await programs.get(id)).toMatchObject({ isActive: true, isArchived: false })
    expect((await programs.listLive()).map((p) => p.id)).toEqual([id])
  })

  it('Keep it on the Archive confirm leaves the active program untouched', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Archive PPL?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    expect(await programs.get(id)).toMatchObject({ isActive: true, isArchived: false })
  })
})

describe('ProgramEditorPage - settings drawer failures', () => {
  const unhandled = vi.fn()

  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
    unhandled.mockClear()
    process.on('unhandledRejection', unhandled)
  })

  afterEach(() => {
    process.off('unhandledRejection', unhandled)
    vi.restoreAllMocks()
  })

  async function expectFailureKept(
    router: ReturnType<typeof renderEditor>,
    id: string,
    message: string,
    dirtyBefore: boolean,
  ) {
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    expect(useProgramDraftStore.getState().draft?.id).toBe(id)
    expect(selectIsDirty(useProgramDraftStore.getState())).toBe(dirtyBefore)
    await new Promise((r) => setTimeout(r, 0))
    expect(unhandled).not.toHaveBeenCalled()
  }

  it('a failed Deactivate shows the alert and leaves the draft as it was', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    vi.spyOn(programs, 'deactivate').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Deactivate program' }))
    await expectFailureKept(router, id, "Couldn't deactivate. Try again.", false)
    expect(useProgramDraftStore.getState().draft?.isActive).toBe(true)
  })

  it('a failed Restore shows the alert and leaves the draft as it was', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('Old', ONE_DAY, { archive: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    vi.spyOn(programs, 'unarchive').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Restore program' }))
    await expectFailureKept(router, id, "Couldn't restore. Try again.", false)
    expect(useProgramDraftStore.getState().draft?.isArchived).toBe(true)
  })

  it('a failed Archive shows the alert and does not navigate', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    vi.spyOn(programs, 'archive').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    await expectFailureKept(router, id, "Couldn't archive. Try again.", false)
  })

  it('a failed Delete shows the alert and does not navigate', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    vi.spyOn(programs, 'softDeleteCascade').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete PPL?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete program' }))
    await expectFailureKept(router, id, "Couldn't delete. Try again.", false)
  })

  it('a dirty Archive whose commit fails reports it and never archives', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    await user.type(await screen.findByLabelText('Day notes'), 'x')
    const sheet = await openSettings(user)
    const archive = vi.spyOn(programs, 'archive')
    vi.spyOn(programs, 'saveTree').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    await expectFailureKept(router, id, "Couldn't archive. Try again.", true)
    expect(archive).not.toHaveBeenCalled()
  })

  it('a failed Archive of the active program through its confirm keeps it active', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    vi.spyOn(programs, 'archive').mockRejectedValueOnce(new Error('x'))
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Archive PPL?' })
    await user.click(within(confirm).getByRole('button', { name: 'Archive program' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expectFailureKept(router, id, "Couldn't archive. Try again.", false)
    expect(await programs.get(id)).toMatchObject({ isActive: true, isArchived: false })
  })

  it('a successful lifecycle action clears an earlier save error', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    renderEditor(`/programs/${id}`)
    await user.type(await screen.findByLabelText('Day notes'), 'x')
    vi.spyOn(programs, 'saveTree').mockRejectedValueOnce(new Error('x'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save. Try again.")
    const sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Deactivate program' }))
    // Wait for the drawer to close: while open, Radix aria-hides the footer alert.
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument()
    expect((await programs.get(id))?.isActive).toBe(false)
  })

  it('a new attempt clears the previous error', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    let sheet = await openSettings(user)
    // The retry is held pending so the editor stays mounted: a successful archive
    // navigates away, which would hide the alert whether or not it was cleared.
    let release!: () => void
    vi.spyOn(programs, 'archive')
      .mockRejectedValueOnce(new Error('x'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    await screen.findByRole('alert')
    sheet = await openSettings(user)
    await user.click(within(sheet).getByRole('button', { name: 'Archive program' }))
    // hidden: true because the open drawer aria-hides the footer alert.
    await waitFor(() =>
      expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument(),
    )
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    release()
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
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

describe('ProgramEditorPage - settings drawer single-flight', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Holds a repo call open until `settle` is called. */
  function hold() {
    let resolve!: () => void
    let reject!: (e: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  it('a double tap on Deactivate calls the repo once and locks the rows', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    renderEditor(`/programs/${id}`)
    await user.type(await screen.findByLabelText('Day notes'), 'x')
    const sheet = await openSettings(user)
    expect(screen.getByRole('button', { name: 'Save', hidden: true })).toBeEnabled()
    const gate = hold()
    const spy = vi.spyOn(programs, 'deactivate').mockImplementation(() => gate.promise)
    const row = within(sheet).getByRole('button', { name: 'Deactivate program' })
    // Both clicks land inside one act(): React has not re-rendered the disabled row yet.
    act(() => {
      row.click()
      row.click()
    })
    expect(spy).toHaveBeenCalledTimes(1)
    for (const name of ['Deactivate program', 'Archive program', 'Delete program']) {
      expect(within(sheet).getByRole('button', { name })).toBeDisabled()
    }
    expect(within(sheet).getByRole('button', { name: 'Archive program' })).not.toHaveTextContent(
      'Soon',
    )
    expect(screen.getByRole('button', { name: 'Save', hidden: true })).toBeDisabled()
    gate.resolve()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a double tap on a direct Archive calls the repo once', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    const gate = hold()
    const spy = vi.spyOn(programs, 'archive').mockImplementation(() => gate.promise)
    const row = within(sheet).getByRole('button', { name: 'Archive program' })
    act(() => {
      row.click()
      row.click()
    })
    expect(spy).toHaveBeenCalledTimes(1)
    gate.resolve()
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a double tap on Restore calls the repo once', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('Old', ONE_DAY, { archive: true })
    renderEditor(`/programs/${id}`)
    const sheet = await openSettings(user)
    const gate = hold()
    const spy = vi.spyOn(programs, 'unarchive').mockImplementation(() => gate.promise)
    const row = within(sheet).getByRole('button', { name: 'Restore program' })
    act(() => {
      row.click()
      row.click()
    })
    expect(spy).toHaveBeenCalledTimes(1)
    gate.resolve()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Delete runs once and the footer stays locked while it is pending', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY)
    const router = renderEditor(`/programs/${id}`)
    await user.type(await screen.findByLabelText('Day notes'), 'x')
    const sheet = await openSettings(user)
    const gate = hold()
    const spy = vi.spyOn(programs, 'softDeleteCascade').mockImplementation(() => gate.promise)
    await user.click(within(sheet).getByRole('button', { name: 'Delete program' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete PPL?' })
    await user.dblClick(within(confirm).getByRole('button', { name: 'Delete program' }))
    expect(spy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
    gate.resolve()
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('after a failure the rows and footer unlock and a retry calls the repo again', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    renderEditor(`/programs/${id}`)
    let sheet = await openSettings(user)
    const gate = hold()
    const spy = vi
      .spyOn(programs, 'deactivate')
      .mockImplementationOnce(() => gate.promise)
      .mockResolvedValueOnce(undefined)
    await user.click(within(sheet).getByRole('button', { name: 'Deactivate program' }))
    expect(within(sheet).getByRole('button', { name: 'Deactivate program' })).toBeDisabled()
    gate.reject(new Error('x'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't deactivate. Try again.")
    sheet = await openSettings(user)
    const row = within(sheet).getByRole('button', { name: 'Deactivate program' })
    expect(row).toBeEnabled()
    await user.click(row)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
