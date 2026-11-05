import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { emptyDraft } from '@/programs/model'
import { DashboardPage } from './DashboardPage'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

async function seed(
  days: { name: string; ids: string[] }[],
  opts: { name?: string; activate?: boolean; archive?: boolean } = {},
) {
  const draft = emptyDraft()
  draft.name = opts.name ?? 'Push Pull Legs'
  draft.days = days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.ids.map((id) => ({
      id: crypto.randomUUID(),
      exerciseRef: ref(id),
      workingSets: 3,
      repMin: 8,
      repMax: 12,
    })),
  }))
  const id = await programs.saveTree(draft, { activate: opts.activate })
  if (opts.archive) await programs.archive(id)
  return id
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('shows the empty state with a link to the Workout tab when nothing is active', async () => {
    await seed([{ name: 'Push', ids: ['barbell-bench-press'] }])
    renderPage()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(await screen.findByText('No active program')).toBeInTheDocument()
    expect(screen.getByText('Activate a program to see your next workout here.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Workout' })).toHaveAttribute('href', '/workout')
    expect(screen.queryByText('Your widgets will show up here.')).not.toBeInTheDocument()
  })

  it('shows the empty state for an archived program', async () => {
    await seed([{ name: 'Push', ids: ['pull-up'] }], { activate: true, archive: true })
    renderPage()
    expect(await screen.findByText('No active program')).toBeInTheDocument()
  })
})
