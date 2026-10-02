import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { selectIsDirty, useProgramDraftStore } from '@/stores/programDraftStore'
import { renderEditor, seedProgram } from './editorTestUtils'

describe('ProgramEditorPage - shell', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  it('/programs/new opens the name prompt and Continue sets the title', async () => {
    const user = userEvent.setup()
    renderEditor('/programs/new')
    const field = await screen.findByLabelText('Program name')
    await user.type(field, 'Push Pull Legs')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: 'Push Pull Legs' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Program name')).not.toBeInTheDocument()
  })

  it('dismissing the prompt keeps "New program"', async () => {
    const user = userEvent.setup()
    renderEditor('/programs/new')
    await screen.findByLabelText('Program name')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('heading', { name: 'New program' })).toBeInTheDocument()
  })

  it('+ Day adds and selects "Day 2"', async () => {
    const user = userEvent.setup()
    renderEditor('/programs/new')
    await screen.findByLabelText('Program name')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Day' }))
    const tab = screen.getByRole('tab', { name: 'Day 2' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(2)
  })

  it('Save persists and lands on /workout', async () => {
    const user = userEvent.setup()
    const router = renderEditor('/programs/new')
    await screen.findByLabelText('Program name')
    await user.type(screen.getByLabelText('Program name'), 'Arms')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const live = await programs.listLive()
    expect(live.map((p) => p.name)).toEqual(['Arms'])
    expect(live[0].isActive).toBe(false)
    expect(useProgramDraftStore.getState().draft).toBeNull()
  })

  it('Activate leaves exactly one active program', async () => {
    const user = userEvent.setup()
    await seedProgram('Old', [{ name: 'A', ids: ['pull-up'] }], { activate: true })
    const router = renderEditor('/programs/new')
    await screen.findByLabelText('Program name')
    await user.type(screen.getByLabelText('Program name'), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const active = (await programs.listLive()).filter((p) => p.isActive)
    expect(active.map((p) => p.name)).toEqual(['Fresh'])
  })

  it('an active program shows a single Save, disabled until an edit', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', [{ name: 'Push', ids: ['pull-up'] }], { activate: true })
    renderEditor(`/programs/${id}`)
    const save = await screen.findByRole('button', { name: 'Save' })
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Day notes'), 'Heavy')
    expect(save).toBeEnabled()
  })

  it('an archived program shows a single Save and no Activate', async () => {
    const id = await seedProgram('Old', [{ name: 'A', ids: ['pull-up'] }], { archive: true })
    renderEditor(`/programs/${id}`)
    await screen.findByRole('button', { name: 'Save' })
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
  })

  it('a failed save shows an inline error, keeps the draft dirty and stays put', async () => {
    const user = userEvent.setup()
    const id = await seedProgram('PPL', [{ name: 'Push', ids: ['pull-up'] }])
    const router = renderEditor(`/programs/${id}`)
    await user.type(await screen.findByLabelText('Day notes'), 'Heavy')
    // Another tab deletes the program behind the editor's back.
    await programs.softDeleteCascade(id)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save. Try again.")
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    expect(selectIsDirty(useProgramDraftStore.getState())).toBe(true)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('an unknown id redirects to /workout', async () => {
    const router = renderEditor('/programs/does-not-exist')
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
  })
})
