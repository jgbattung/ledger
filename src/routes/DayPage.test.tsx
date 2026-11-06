import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { workouts } from '@/db/repos'
import { useSessionStore } from '@/stores/sessionStore'
import { DayPage } from '@/routes/DayPage'
import { seedProgram } from '@/routes/editorTestUtils'

function renderDay(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/workout', element: <p>Workout tab</p> },
      { path: '/session', element: <p>Session</p> },
      { path: '/programs/:programId/days/:dayId', element: <DayPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function seed(opts: { targets?: boolean; archive?: boolean } = {}) {
  const programId = await seedProgram(
    'PPL',
    [
      { name: 'Push', ids: ['barbell-bench-press', 'dumbbell-flyes'] },
      { name: 'Rest', ids: [] },
    ],
    opts,
  )
  const { programs } = await import('@/db/repos')
  const tree = await programs.loadTree(programId)
  return { programId, pushId: tree!.days[0].day.id, restId: tree!.days[1].day.id }
}

describe('DayPage', () => {
  beforeEach(async () => {
    await resetDb()
    useSessionStore.getState().reset()
  })

  it('shows the day, program, counts, exercises with targets and a Start button', async () => {
    const { programId, pushId } = await seed()
    renderDay(`/programs/${programId}/days/${pushId}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    expect(screen.getByText('PPL')).toBeInTheDocument()
    expect(screen.getByText('2 exercises · 6 working sets')).toBeInTheDocument()
    expect(screen.getAllByText('3 × 8–12 · RIR 0')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('shows the dashed no-targets chip when targets are incomplete', async () => {
    const { programId, pushId } = await seed({ targets: false })
    renderDay(`/programs/${programId}/days/${pushId}`)
    expect(await screen.findAllByText('No targets · starts with 1 set')).toHaveLength(2)
    expect(screen.getByText('2 exercises · 2 working sets')).toBeInTheDocument()
  })

  it('Start creates the workout and navigates to /session', async () => {
    const { programId, pushId } = await seed()
    const user = userEvent.setup()
    const router = renderDay(`/programs/${programId}/days/${pushId}`)
    await user.click(await screen.findByRole('button', { name: 'Start workout' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
    expect(await workouts.getInProgress()).toMatchObject({ name: 'Push', programName: 'PPL' })
  })

  it('shows Resume when a workout is in progress and does not start another', async () => {
    const { programId, pushId } = await seed()
    await useSessionStore.getState().start(programId, pushId)
    const user = userEvent.setup()
    const router = renderDay(`/programs/${programId}/days/${pushId}`)
    await user.click(await screen.findByRole('button', { name: 'Resume workout' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/session'))
  })

  it('renders an empty state with Back for a rest day', async () => {
    const { programId, restId } = await seed()
    const user = userEvent.setup()
    const router = renderDay(`/programs/${programId}/days/${restId}`)
    expect(await screen.findByText("This day can't be started")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /workout/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout'))
  })

  it('renders an empty state for a missing program or an archived program', async () => {
    renderDay('/programs/nope/days/nope')
    expect(await screen.findByText("This day can't be started")).toBeInTheDocument()
  })

  it('renders an empty state for an archived program', async () => {
    const { programId, pushId } = await seed({ archive: true })
    renderDay(`/programs/${programId}/days/${pushId}`)
    expect(await screen.findByText("This day can't be started")).toBeInTheDocument()
  })
})
