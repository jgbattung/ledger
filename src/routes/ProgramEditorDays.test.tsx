import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDb } from '@/db/test-utils'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { renderEditor, seedProgram } from './editorTestUtils'

const TWO_DAYS = [
  { name: 'Push', ids: ['barbell-bench-press', 'pull-up'] },
  { name: 'Rest', ids: [] },
]

async function open(days = TWO_DAYS) {
  const id = await seedProgram('PPL', days)
  renderEditor(`/programs/${id}`)
  await screen.findByRole('tablist')
  return id
}

describe('ProgramEditorPage - day actions and exercises', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
  })

  it('shows the five chips with exact names; Re-order and Duplicate are disabled', async () => {
    await open()
    for (const name of ['Rename', 'Change to Rest', 'Remove']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
    expect(screen.getByRole('button', { name: 'Re-order' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
  })

  it('Rename updates the day tab', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const field = await screen.findByLabelText('Day name')
    await user.clear(field)
    await user.type(field, 'Upper{Enter}')
    expect(screen.getByRole('tab', { name: 'Upper' })).toBeInTheDocument()
  })

  it('Change to Rest confirms, empties the day and switches to the rest body', async () => {
    const user = userEvent.setup()
    await open()
    expect(screen.getByText('2 exercises')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change to Rest' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Change Push to a rest day?')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Change to Rest' }))
    expect(await screen.findByText('Rest day')).toBeInTheDocument()
    expect(screen.queryByText('2 exercises')).not.toBeInTheDocument()
  })

  it('on a rest day only Rename, Duplicate and Remove show', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('tab', { name: 'Rest' }))
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change to Rest' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Re-order' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add exercises' })).toBeInTheDocument()
  })

  it('Remove confirms when the day has exercises and is direct when empty', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Remove Push?')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Remove day' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Rest is now the only day: removal is disabled.
    expect(screen.queryByRole('tab', { name: 'Push' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })

  it('removes an empty day without asking', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('tab', { name: 'Rest' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Rest' })).not.toBeInTheDocument()
  })

  it('Remove is disabled on the only day', async () => {
    await open([{ name: 'Solo', ids: ['pull-up'] }])
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })

  it('removing an exercise updates the count and shows the no-targets hint', async () => {
    const user = userEvent.setup()
    await open()
    expect(screen.getAllByText('No targets yet')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remove Pull-Up' }))
    expect(screen.getByText('1 exercise')).toBeInTheDocument()
  })

  it('Add exercises links to the picker with the day id', async () => {
    await open()
    const link = screen.getByRole('link', { name: 'Add exercises' })
    expect(link).toHaveAttribute('href', expect.stringMatching(/^\/programs\/.+\/exercises\?day=.+/))
  })
})
