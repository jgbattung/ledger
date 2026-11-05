import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  const SIX = [
    { name: 'Push A', ids: ['barbell-bench-press', 'cable-lateral-raise'] },
    { name: 'Pull A', ids: ['pull-up', 'bent-over-barbell-row'] },
    { name: 'Rest', ids: [] },
    { name: 'Push B', ids: ['incline-dumbbell-press'] },
    { name: 'Pull B', ids: ['chin-up'] },
  ]

  async function complete(programId: string, ...dayNames: string[]) {
    const tree = (await programs.loadTree(programId))!
    for (const name of dayNames) {
      await programs.completeDay(programId, tree.days.find((d) => d.day.name === name)!.day.id)
    }
  }

  it('workout card shows the day name, meta, exercise summary and pass bar', async () => {
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Pull A' })).toBeInTheDocument()
    expect(screen.getByText('Push Pull Legs')).toBeInTheDocument()
    expect(screen.getByText('2 exercises · 6 working sets')).toBeInTheDocument()
    expect(screen.getByText('Pull-Up, Bent Over Barbell Row')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 2 of 5: 1 done' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View in Workout' })).toHaveAttribute('href', '/workout')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('a single exercise and set read in the singular', async () => {
    await seed([{ name: 'Solo', ids: ['pull-up'] }], { activate: true })
    renderPage()
    expect(await screen.findByText('1 exercise · 3 working sets')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 1 of 1: 0 done' })).toBeInTheDocument()
  })

  it('rest card names the next day that is not done and offers the checkbox', async () => {
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A', 'Pull A', 'Push B')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(screen.getByText('Then Pull B')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mark rest day done' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByText('Moves you on to Pull B')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View in Workout' })).not.toBeInTheDocument()
  })

  it('ticking the rest day advances the card', async () => {
    const user = userEvent.setup()
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A', 'Pull A')
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: 'Mark rest day done' }))
    expect(await screen.findByRole('heading', { name: 'Push B' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 4 of 5: 3 done' })).toBeInTheDocument()
  })

  it('ignores a second tap while the rest tick is saving', async () => {
    const user = userEvent.setup()
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A', 'Pull A')
    renderPage()
    const real = programs.completeDay.bind(programs)
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const spy = vi.spyOn(programs, 'completeDay').mockImplementationOnce(async (...args) => {
      await gate
      return real(...args)
    })

    const box = await screen.findByRole('checkbox', { name: 'Mark rest day done' })
    await user.click(box)
    await waitFor(() => expect(box).toHaveAttribute('aria-disabled', 'true'))
    await user.click(box)
    expect(spy).toHaveBeenCalledTimes(1)

    release()
    expect(await screen.findByRole('heading', { name: 'Push B' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('pass bar segments expose their done, next, upcoming and rest state', async () => {
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A', 'Push B')
    renderPage()
    const bar = await screen.findByRole('img', { name: 'Day 2 of 5: 2 done' })
    const segments = Array.from(bar.firstElementChild!.children)
    expect(segments).toHaveLength(5)
    // Push A done, Pull A next, Rest upcoming (dashed), Push B done, Pull B upcoming.
    expect(segments.map((segment) => segment.getAttribute('data-state'))).toEqual([
      'done',
      'next',
      'upcoming',
      'done',
      'upcoming',
    ])
    expect(segments.map((segment) => segment.getAttribute('data-rest'))).toEqual([
      null,
      null,
      'true',
      null,
      null,
    ])
    // The one remaining class-level check: the pass bar never uses the brand accent.
    for (const segment of segments) expect(segment.className).not.toMatch(/\bprimary\b/)

    const labels = Array.from(bar.children[1].children)
    expect(labels.map((label) => label.textContent)).toEqual(SIX.map((day) => day.name))
    expect(labels.map((label) => label.getAttribute('data-state'))).toEqual([
      'done',
      'next',
      'upcoming',
      'done',
      'upcoming',
    ])
  })

  it('a rest day up next is drawn dashed in solid ink', async () => {
    const id = await seed(SIX, { activate: true })
    await complete(id, 'Push A', 'Pull A')
    renderPage()
    const bar = await screen.findByRole('img', { name: 'Day 3 of 5: 2 done' })
    expect(bar.firstElementChild!.children[2]).toHaveAttribute('data-state', 'next')
    expect(bar.firstElementChild!.children[2]).toHaveAttribute('data-rest', 'true')
  })

  it('a rest-only program resets on tick and the card stays on the same day (UX note)', async () => {
    const user = userEvent.setup()
    await seed([{ name: 'Rest', ids: [] }], { activate: true })
    renderPage()
    expect(await screen.findByText('Then Rest')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Mark rest day done' }))
    expect(await screen.findByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 1 of 1: 0 done' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mark rest day done' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('ticking the last undone rest day wraps to Day 1', async () => {
    const user = userEvent.setup()
    const id = await seed(
      [
        { name: 'Push', ids: ['pull-up'] },
        { name: 'Rest', ids: [] },
        { name: 'Pull', ids: ['chin-up'] },
      ],
      { activate: true },
    )
    await complete(id, 'Push', 'Pull')
    renderPage()
    expect(await screen.findByText('Then Push')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Mark rest day done' }))
    expect(await screen.findByRole('heading', { name: 'Push' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Day 1 of 3: 0 done' })).toBeInTheDocument()
  })
})
