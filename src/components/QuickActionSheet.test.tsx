import { beforeEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QuickActionSheet } from './QuickActionSheet'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { emptyDraft } from '@/programs/model'
import { useSessionStore } from '@/stores/sessionStore'

function Harness() {
  const [open, setOpen] = useState(true)
  return <QuickActionSheet open={open} onOpenChange={setOpen} />
}

function renderSheet() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/workout" element={<Harness />} />
        <Route path="/programs/new" element={<p>Editor</p>} />
        <Route path="/programs/:programId/days/:dayId" element={<p>Day page</p>} />
        <Route path="/session" element={<p>Session</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function seedActive(days: { name: string; ids: string[] }[]) {
  const draft = emptyDraft()
  draft.name = 'PPL'
  draft.days = days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.ids.map((id) => ({
      id: crypto.randomUUID(),
      exerciseRef: { source: 'db' as const, exerciseId: id },
      workingSets: 3,
      repMin: 8,
      repMax: 12,
    })),
  }))
  const id = await programs.saveTree(draft, { activate: true })
  return { id, tree: (await programs.loadTree(id))! }
}

describe('QuickActionSheet', () => {
  beforeEach(async () => {
    await resetDb()
    useSessionStore.getState().reset()
  })

  it('keeps the approved order with Start next workout and Start new program enabled', () => {
    renderSheet()
    expect(screen.getByRole('link', { name: 'Start next workout' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Start new program' })
    expect(link).toHaveAttribute('href', '/programs/new')
    for (const label of ['Create exercise', 'Log bodyweight', 'Progress photo']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeDisabled()
    }
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toMatch(/Start next workout/)
    expect(rows[1]).toMatch(/Start new program/)
  })

  it('with no active program Start next workout goes to the Workout tab', () => {
    renderSheet()
    expect(screen.getByRole('link', { name: 'Start next workout' })).toHaveAttribute(
      'href',
      '/workout',
    )
  })

  it('opens the active program up-next Day page', async () => {
    const { id, tree } = await seedActive([
      { name: 'Push', ids: ['barbell-bench-press'] },
      { name: 'Pull', ids: ['pull-up'] },
    ])
    await programs.completeDay(id, tree.days[0].day.id)
    const user = userEvent.setup()
    renderSheet()
    const link = await screen.findByRole('link', { name: 'Start next workout' })
    await waitFor(() =>
      expect(link).toHaveAttribute('href', `/programs/${id}/days/${tree.days[1].day.id}`),
    )
    await user.click(link)
    expect(await screen.findByText('Day page')).toBeInTheDocument()
  })

  it('reads Resume workout and opens /session while a workout is in progress', async () => {
    const { id, tree } = await seedActive([{ name: 'Push', ids: ['barbell-bench-press'] }])
    await useSessionStore.getState().start(id, tree.days[0].day.id)
    const user = userEvent.setup()
    renderSheet()
    const link = await screen.findByRole('link', { name: 'Resume workout' })
    expect(screen.queryByRole('link', { name: 'Start next workout' })).toBeNull()
    await user.click(link)
    expect(await screen.findByText('Session')).toBeInTheDocument()
  })

  it('navigates to the editor and closes the sheet when the row is tapped', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('link', { name: 'Start new program' }))
    expect(await screen.findByText('Editor')).toBeInTheDocument()
    expect(screen.queryByText('Quick actions')).not.toBeInTheDocument()
  })

  it('closes the sheet on tap while staying on the page when navigation is not mounted', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Start new program' }))
    expect(screen.queryByText('Quick actions')).not.toBeInTheDocument()
  })
})

