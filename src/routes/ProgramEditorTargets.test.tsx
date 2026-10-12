import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { firstIncompleteExercise, programTreeToDraft } from '@/programs/model'
import { selectIsDirty, useProgramDraftStore } from '@/stores/programDraftStore'
import { renderEditor, seedProgram } from './editorTestUtils'

const ONE_DAY = [{ name: 'Push', ids: ['barbell-bench-press', 'pull-up'] }]
const GATE_NOTICE = 'Set sets and reps to activate this program.'

type User = ReturnType<typeof userEvent.setup>

async function open(days = ONE_DAY, opts: { targets?: boolean } = { targets: false }) {
  const id = await seedProgram('PPL', days, opts)
  const router = renderEditor(`/programs/${id}`)
  await screen.findByRole('tablist')
  return { id, router }
}

async function configure(user: User, name: string, sets: string, min: string, max: string) {
  await user.click(screen.getByRole('button', { name: `Configure ${name}` }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox', { name: 'Sets' }), sets)
  await user.type(within(dialog).getByRole('textbox', { name: 'Rep min' }), min)
  await user.type(within(dialog).getByRole('textbox', { name: 'Rep max' }), max)
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('ProgramEditorPage - exercise targets', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  it('rows expose Configure buttons and Remove still works on its own', async () => {
    const user = userEvent.setup()
    await open()
    expect(screen.getByRole('button', { name: 'Configure Barbell Bench Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configure Pull-Up' })).toBeInTheDocument()
    expect(screen.getAllByText('No targets yet')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Remove Pull-Up' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configure Pull-Up' })).not.toBeInTheDocument()
    expect(screen.getByText('1 exercise')).toBeInTheDocument()
  })

  it('tapping a row, filling sets and reps and saving shows the summary and enables Save', async () => {
    const user = userEvent.setup()
    await open()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    await configure(user, 'Barbell Bench Press', '3', '8', '12')

    expect(screen.getByText('3 × 8–12 · RIR 0')).toBeInTheDocument()
    expect(screen.getAllByText('No targets yet')).toHaveLength(1)
    expect(save).toBeEnabled()
  })

  it('the drawer starts empty for a new exercise and dismissing discards edits', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('button', { name: 'Configure Pull-Up' }))
    const dialog = await screen.findByRole('dialog')
    const sets = within(dialog).getByRole('textbox', { name: 'Sets' })
    expect(sets).toHaveValue('')
    await user.type(sets, '5')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(screen.getAllByText('No targets yet')).toHaveLength(2)
    expect(selectIsDirty(useProgramDraftStore.getState())).toBe(false)
  })

  it('footer Save persists all seven fields and reopening the editor shows them', async () => {
    const user = userEvent.setup()
    const { id, router } = await open()
    await user.click(screen.getByRole('button', { name: 'Configure Barbell Bench Press' }))
    const dialog = await screen.findByRole('dialog')
    const type = (name: string, value: string) =>
      user.type(within(dialog).getByRole('textbox', { name }), value)
    await type('Sets', '4')
    await type('Rep min', '6')
    await type('Rep max', '10')
    await type('RIR', '2')
    await type('Rest', '230')
    await type('Warm-ups', '1')
    await type('Notes', 'Pause')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('4 × 6–10 · RIR 2 · rest 2:30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const tree = await programs.loadTree(id)
    expect(tree!.days[0].exercises[0]).toMatchObject({
      workingSets: 4,
      repMin: 6,
      repMax: 10,
      rirTarget: 2,
      restSeconds: 150,
      warmupSetCount: 1,
      notes: 'Pause',
    })

    cleanup()
    useProgramDraftStore.getState().reset()
    renderEditor(`/programs/${id}`)
    await screen.findByRole('tablist')
    await user.click(screen.getByRole('button', { name: 'Configure Barbell Bench Press' }))
    const reopened = await screen.findByRole('dialog')
    expect(within(reopened).getByRole('textbox', { name: 'Sets' })).toHaveValue('4')
    expect(within(reopened).getByRole('textbox', { name: 'Rep min' })).toHaveValue('6')
    expect(within(reopened).getByRole('textbox', { name: 'Rep max' })).toHaveValue('10')
    expect(within(reopened).getByRole('textbox', { name: 'RIR' })).toHaveValue('2')
    expect(within(reopened).getByRole('textbox', { name: 'Rest' })).toHaveValue('2:30')
    expect(within(reopened).getByRole('textbox', { name: 'Warm-ups' })).toHaveValue('1')
    expect(within(reopened).getByRole('textbox', { name: 'Notes' })).toHaveValue('Pause')
  })

  it('Activate with an incomplete exercise on another day selects that day and opens its drawer', async () => {
    const user = userEvent.setup()
    const days = [
      { name: 'Push', ids: ['barbell-bench-press'] },
      { name: 'Pull', ids: ['pull-up'] },
    ]
    const { id, router } = await open(days)
    await configure(user, 'Barbell Bench Press', '3', '8', '12')

    await user.click(screen.getByRole('button', { name: 'Activate' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Pull-Up' })).toBeInTheDocument()
    expect(within(dialog).getByText(GATE_NOTICE)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pull', selected: true, hidden: true })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/programs/${id}`)
    expect((await programs.listLive()).some((p) => p.isActive)).toBe(false)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('after completing the flagged exercise, Activate succeeds and goes to /workout', async () => {
    const user = userEvent.setup()
    const { id, router } = await open()
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Barbell Bench Press' })).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Sets' }), '3')
    await user.type(within(dialog).getByRole('textbox', { name: 'Rep min' }), '8')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Pull-Up is still incomplete, so the gate fires again, on that exercise.
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    const second = await screen.findByRole('dialog')
    expect(within(second).getByRole('heading', { name: 'Pull-Up' })).toBeInTheDocument()
    await user.type(within(second).getByRole('textbox', { name: 'Sets' }), '3')
    await user.type(within(second).getByRole('textbox', { name: 'Rep max' }), '10')
    await user.click(within(second).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    const active = (await programs.listLive()).filter((p) => p.isActive)
    expect(active.map((p) => p.id)).toEqual([id])
  })

  it('opening a row by tap does not show the gate notice', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('button', { name: 'Configure Pull-Up' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(GATE_NOTICE)).not.toBeInTheDocument()
  })

  it('saving an incomplete program to the library succeeds', async () => {
    const user = userEvent.setup()
    const { id, router } = await open()
    await user.type(screen.getByLabelText('Day notes'), 'Heavy')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
    expect((await programs.get(id))?.isActive).toBe(false)
  })

  it('saving an active program with a gap keeps it active (handled in LG-022)', async () => {
    // Characterization: Save is never gated, so an already-active program can
    // end up with an exercise missing targets. Accepted for LG-052; LG-022
    // owns what happens when a workout starts from such a day.
    const user = userEvent.setup()
    const id = await seedProgram('PPL', ONE_DAY, { activate: true })
    const router = renderEditor(`/programs/${id}`)
    await screen.findByRole('tablist')

    await user.click(screen.getByRole('button', { name: 'Configure Pull-Up' }))
    const dialog = await screen.findByRole('dialog')
    await user.clear(within(dialog).getByRole('textbox', { name: 'Sets' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByText('No targets yet')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))

    expect((await programs.get(id))?.isActive).toBe(true)
    const tree = await programs.loadTree(id)
    expect(firstIncompleteExercise(programTreeToDraft(tree!))).not.toBeNull()
  })
})
