import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { sets, workouts } from '@/db/repos'
import { ExerciseDetailPage } from '@/routes/ExerciseDetailPage'
import { ExerciseHistory } from '@/components/library/ExerciseHistory'
import { exercise, seedProgram } from '@/workouts/test-fixtures'

const BENCH = { source: 'db' as const, exerciseId: 'barbell-bench-press' }

type Logged = { weight: number; reps: number; rir?: number; rirIsPlus?: boolean; partialReps?: number }

async function finishedWorkout(
  programId: string,
  dayId: string,
  at: Date,
  logged: Logged[],
): Promise<string> {
  const id = await workouts.startFromProgramDay(programId, dayId)
  const session = await workouts.loadSession(id)
  const rows = session!.exercises[0].sets
  for (const [index, entry] of logged.entries()) {
    await sets.patch(rows[index].id, { rir: 0, ...entry })
    await sets.setCompleted(rows[index].id, true)
  }
  await workouts.finish(id)
  await workouts.update(id, { startedAt: at.getTime(), finishedAt: at.getTime() + 3_600_000 })
  return id
}

async function seed() {
  return seedProgram([exercise('barbell-bench-press', { workingSets: 3 })])
}

function thisYear(month: number, day: number) {
  return new Date(new Date().getFullYear(), month, day, 12)
}

describe('ExerciseHistory', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('renders one block per workout, newest first, with date, workout line and sets', async () => {
    const { programId, pushId } = await seed()
    const older = thisYear(0, 3)
    const newer = thisYear(0, 10)
    await finishedWorkout(programId, pushId, older, [{ weight: 30, reps: 10, rir: 1 }])
    await finishedWorkout(programId, pushId, newer, [
      { weight: 32.5, reps: 9, rir: 1 },
      { weight: 32.5, reps: 8, rir: 0 },
    ])

    render(<ExerciseHistory exerciseRef={BENCH} />)
    const blocks = await screen.findAllByRole('listitem').then((items) =>
      items.filter((item) => item.className.includes('grid-cols-')),
    )
    expect(blocks).toHaveLength(2)

    expect(within(blocks[0]).getByText('10')).toBeInTheDocument()
    expect(within(blocks[0]).getByText('Jan')).toBeInTheDocument()
    expect(within(blocks[0]).getByText(/^\w{3} · Push · PPL$/)).toBeInTheDocument()
    expect(within(blocks[0]).getByText('32.5 kg × 9')).toBeInTheDocument()
    expect(within(blocks[0]).getByText('32.5 kg × 8')).toBeInTheDocument()
    expect(within(blocks[0]).getByText('RIR 1')).toBeInTheDocument()

    expect(within(blocks[1]).getByText('3')).toBeInTheDocument()
    expect(within(blocks[1]).getByText('30 kg × 10')).toBeInTheDocument()
  })

  it('renders partial reps after the divider', async () => {
    const { programId, pushId } = await seed()
    await finishedWorkout(programId, pushId, thisYear(0, 10), [
      { weight: 32.5, reps: 8, rir: 0, partialReps: 2 },
    ])
    render(<ExerciseHistory exerciseRef={BENCH} />)
    const line = await screen.findByText(/^32\.5 kg × 8/)
    expect(line).toHaveTextContent('32.5 kg × 8|2')
  })

  it('renders a 6+ RIR as RIR 6+', async () => {
    const { programId, pushId } = await seed()
    await finishedWorkout(programId, pushId, thisYear(0, 10), [
      { weight: 20, reps: 12, rir: 6, rirIsPlus: true },
    ])
    render(<ExerciseHistory exerciseRef={BENCH} />)
    expect(await screen.findByText('RIR 6+')).toBeInTheDocument()
  })

  it('appends the year for a workout from a previous calendar year', async () => {
    const { programId, pushId } = await seed()
    const past = new Date(new Date().getFullYear() - 1, 10, 4, 12)
    await finishedWorkout(programId, pushId, past, [{ weight: 30, reps: 10 }])
    await finishedWorkout(programId, pushId, thisYear(0, 10), [{ weight: 30, reps: 10 }])
    render(<ExerciseHistory exerciseRef={BENCH} />)
    await screen.findAllByText('30 kg × 10')
    expect(screen.getAllByText(String(past.getFullYear()))).toHaveLength(1)
  })

  it('shows the empty state when nothing is logged', async () => {
    render(<ExerciseHistory exerciseRef={BENCH} />)
    expect(await screen.findByText('No sets logged yet')).toBeInTheDocument()
    expect(screen.getByText('Sets you log for this exercise will show up here.')).toBeInTheDocument()
  })
})

describe('ExerciseDetailPage History tab', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('loads history on the History tab and never mentions an estimated max', async () => {
    const { programId, pushId } = await seed()
    await finishedWorkout(programId, pushId, thisYear(0, 3), [{ weight: 30, reps: 10, rir: 1 }])
    const router = createMemoryRouter(
      [{ path: '/exercises/:source/:exerciseId', element: <ExerciseDetailPage /> }],
      { initialEntries: ['/exercises/db/barbell-bench-press?tab=history'] },
    )
    const { container } = render(<RouterProvider router={router} />)
    expect(await screen.findByText('30 kg × 10')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/e1rm|1rm/i)
  })
})
