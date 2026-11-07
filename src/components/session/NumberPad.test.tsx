import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { programs } from '@/db/repos'
import { resetDb } from '@/db/test-utils'
import { seedProgram } from '@/routes/editorTestUtils'
import { useSessionStore } from '@/stores/sessionStore'
import { NumberPad } from '@/components/session/NumberPad'

const store = () => useSessionStore.getState()
const firstSet = () => store().exercises[0].sets[0]

async function startAndOpen(field: 'weight' | 'reps') {
  const programId = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
  const tree = (await programs.loadTree(programId))!
  await store().start(programId, tree.days[0].day.id)
  act(() => store().openPad(firstSet().id, field))
  render(<NumberPad />)
}

describe('NumberPad', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  it('renders nothing while no cell is being edited', () => {
    render(<NumberPad />)
    expect(screen.queryByRole('group', { name: 'Number pad' })).toBeNull()
  })

  it('first press replaces, later presses append', async () => {
    await startAndOpen('weight')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '6' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(firstSet().weight).toBe(62)
    await user.click(screen.getByRole('button', { name: 'Decimal point' }))
    await user.click(screen.getByRole('button', { name: '5' }))
    expect(firstSet().weight).toBe(62.5)
  })

  it('weight hides the RIR row and dims F|P; reps dims the decimal key', async () => {
    await startAndOpen('weight')
    expect(screen.queryByRole('button', { name: /^RIR/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Partial reps' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeEnabled()
    act(() => store().openPad(firstSet().id, 'reps'))
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Partial reps' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /^RIR/ })).toHaveLength(7)
  })

  it('F|P edits partials and the set reads 8 | 1', async () => {
    await startAndOpen('reps')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '8' }))
    const toggle = screen.getByRole('button', { name: 'Partial reps' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '1' }))
    expect(firstSet()).toMatchObject({ reps: 8, partialReps: 1 })
  })

  it('backspace in P mode clears partials first', async () => {
    await startAndOpen('reps')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '8' }))
    await user.click(screen.getByRole('button', { name: 'Partial reps' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(firstSet()).toMatchObject({ reps: 8, partialReps: undefined })
  })

  it('Next walks weight, reps, then the next set weight; F is the mode again', async () => {
    await startAndOpen('weight')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(store().pad?.entry.field).toBe('reps')
    await user.click(screen.getByRole('button', { name: 'Partial reps' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(store().pad).toMatchObject({ setId: store().exercises[0].sets[1].id })
    expect(store().pad?.entry).toMatchObject({ field: 'weight', mode: 'F' })
  })

  it('RIR circles set the RIR; 6+ sets rirIsPlus', async () => {
    await startAndOpen('reps')
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'RIR 0' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'RIR 3' }))
    expect(firstSet()).toMatchObject({ rir: 3, rirIsPlus: false })
    await user.click(screen.getByRole('button', { name: 'RIR 6 or more' }))
    expect(firstSet()).toMatchObject({ rir: 6, rirIsPlus: true })
    expect(screen.getByRole('button', { name: 'RIR 6 or more' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'RIR 5' }))
    expect(firstSet()).toMatchObject({ rir: 5, rirIsPlus: false })
  })

  it('Hide keypad is the only way to close it', async () => {
    await startAndOpen('weight')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Hide keypad' }))
    expect(screen.queryByRole('group', { name: 'Number pad' })).toBeNull()
    expect(store().pad).toBeNull()
  })

  it('persists every key press to Dexie', async () => {
    await startAndOpen('reps')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await store().flushNotes()
    const { db } = await import('@/db/ledger')
    expect((await db.sets.get(firstSet().id))?.reps).toBe(12)
  })
})
