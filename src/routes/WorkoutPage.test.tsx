import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { emptyDraft, programTreeToDraft } from '@/programs/model'
import { WorkoutPage } from './WorkoutPage'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

async function seed(
  name: string,
  days: { name: string; ids: string[] }[],
  opts: { activate?: boolean; archive?: boolean } = {},
) {
  const draft = emptyDraft()
  draft.name = name
  draft.days = days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.ids.map((id) => ({ id: crypto.randomUUID(), exerciseRef: ref(id) })),
  }))
  const id = await programs.saveTree(draft, { activate: opts.activate })
  if (opts.archive) await programs.archive(id)
  return id
}

const PPL = [
  { name: 'Push', ids: ['barbell-bench-press'] },
  { name: 'Pull', ids: ['pull-up'] },
  { name: 'Legs', ids: ['barbell-squat'] },
  { name: 'Rest', ids: [] },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkoutPage />
    </MemoryRouter>,
  )
}

describe('WorkoutPage', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('shows the empty state with a button to /programs/new', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Workout' })).toBeInTheDocument()
    const button = await screen.findByRole('link', { name: 'Create your first program' })
    expect(button).toHaveAttribute('href', '/programs/new')
    expect(screen.getByRole('link', { name: 'New program' })).toHaveAttribute('href', '/programs/new')
  })

  it('expands the active program, collapses library cards, and the caret toggles', async () => {
    const user = userEvent.setup()
    await seed('Push Pull Legs', PPL, { activate: true })
    await seed('Upper / Lower', [{ name: 'Upper', ids: ['pull-up'] }])
    await seed('Arms', [{ name: 'Arms', ids: ['pull-up'] }])
    renderPage()

    const header = await screen.findByRole('link', { name: /Push Pull Legs/ })
    expect(header).toHaveAttribute('href', expect.stringMatching(/^\/programs\/.+/))
    expect(within(header).getByText('3 workouts')).toBeInTheDocument()

    const activeToggle = screen.getByRole('button', { name: 'Collapse Push Pull Legs' })
    expect(activeToggle).toHaveAttribute('aria-expanded', 'true')
    const rows = document.getElementById(activeToggle.getAttribute('aria-controls')!)!
    expect(within(rows).getAllByRole('listitem')).toHaveLength(4)
    expect(rows).toBeVisible()

    const libToggle = screen.getByRole('button', { name: 'Expand Upper / Lower' })
    expect(libToggle).toHaveAttribute('aria-expanded', 'false')
    const libRows = document.getElementById(libToggle.getAttribute('aria-controls')!)!
    expect(libRows).not.toBeVisible()
    await user.click(libToggle)
    expect(libRows).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Collapse Upper / Lower' }))
    expect(libRows).not.toBeVisible()
  })

  it('day rows contain no links or buttons', async () => {
    await seed('Push Pull Legs', PPL, { activate: true })
    renderPage()
    const toggle = await screen.findByRole('button', { name: 'Collapse Push Pull Legs' })
    const rows = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(within(rows).queryAllByRole('link')).toHaveLength(0)
    expect(within(rows).queryAllByRole('button')).toHaveLength(0)
    expect(within(rows).getByText('Rest')).toBeInTheDocument()
    expect(within(rows).getByText('Pull-Up')).toBeInTheDocument()
  })

  it('shows a hint when programs exist but none is active', async () => {
    await seed('Upper / Lower', [{ name: 'Upper', ids: ['pull-up'] }])
    renderPage()
    expect(await screen.findByText('Open a program and tap Activate.')).toBeInTheDocument()
  })

  it('reveals archived programs through the disclosure', async () => {
    const user = userEvent.setup()
    await seed('Old plan', [{ name: 'A', ids: ['pull-up'] }], { archive: true })
    await seed('Current', [{ name: 'A', ids: ['pull-up'] }], { activate: true })
    renderPage()

    const disclosure = await screen.findByRole('button', { name: /Archived · 1/ })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: /Old plan/, hidden: true })).not.toBeVisible()
    await user.click(disclosure)
    expect(screen.getByRole('link', { name: /Old plan/ })).toBeVisible()
  })

  it('hides the archived disclosure when nothing is archived', async () => {
    await seed('Current', [{ name: 'A', ids: ['pull-up'] }], { activate: true })
    renderPage()
    await screen.findByRole('link', { name: /Current/ })
    expect(screen.queryByRole('button', { name: /Archived/ })).not.toBeInTheDocument()
  })

  it('orders the library by most recently updated', async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const days = [{ name: 'D', ids: ['pull-up'] }]
    const a = await seed('Alpha', days)
    await wait(5)
    await seed('Bravo', days)
    await wait(5)
    await seed('Charlie', days)
    await wait(5)
    const draft = programTreeToDraft((await programs.loadTree(a))!)
    draft.notes = 'touched'
    await programs.saveTree(draft)
    renderPage()
    await screen.findByRole('link', { name: /Alpha/ })
    const order = screen
      .getAllByRole('link', { name: /workout/ })
      .map((link) => /Alpha|Bravo|Charlie/.exec(link.textContent ?? '')?.[0])
    expect(order).toEqual(['Alpha', 'Charlie', 'Bravo'])
  })

  it('reads "1 workout" for a single non-rest day', async () => {
    await seed('Solo', [
      { name: 'Only', ids: ['pull-up'] },
      { name: 'Rest', ids: [] },
    ])
    renderPage()
    const header = await screen.findByRole('link', { name: /Solo/ })
    expect(within(header).getByText('1 workout')).toBeInTheDocument()
  })

  it('an archived-only program still shows the empty state and the Archived disclosure', async () => {
    await seed('Old plan', [{ name: 'A', ids: ['pull-up'] }], { archive: true })
    renderPage()
    expect(await screen.findByRole('link', { name: 'Create your first program' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Archived · 1/ })).toBeInTheDocument()
  })
})
