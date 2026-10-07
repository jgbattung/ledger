import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QuickActionSheet } from './QuickActionSheet'

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
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuickActionSheet', () => {
  it('keeps the approved order with only Start new program enabled', () => {
    renderSheet()
    const link = screen.getByRole('link', { name: 'Start new program' })
    expect(link).toHaveAttribute('href', '/programs/new')
    for (const label of ['Start next workout', 'Create exercise', 'Log bodyweight', 'Progress photo']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeDisabled()
    }
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toMatch(/Start next workout/)
    expect(rows[1]).toMatch(/Start new program/)
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
