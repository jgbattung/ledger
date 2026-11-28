import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { resetDb } from '@/db/test-utils'
import { programs, workouts } from '@/db/repos'
import { WorkoutSummaryPage } from '@/routes/WorkoutSummaryPage'
import { seedProgram } from '@/routes/editorTestUtils'
import { SettingsProvider } from '@/settings/SettingsProvider'

function renderSummary(id: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Dashboard</p> },
      { path: '/session', element: <p>Session</p> },
      { path: '/workouts/:workoutId', element: <WorkoutSummaryPage /> },
    ],
    { initialEntries: [`/workouts/${id}`] },
  )
  render(
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>,
  )
  return router
}

async function startPush() {
  const programId = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
  const tree = (await programs.loadTree(programId))!
  return workouts.startFromProgramDay(programId, tree.days[0].day.id)
}

describe('WorkoutSummaryPage redirects', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('sends an in-progress workout to the Ongoing Workout', async () => {
    const router = renderSummary(await startPush())
    expect(await screen.findByText('Session')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/session')
  })

  it('sends a discarded workout to the Dashboard', async () => {
    const id = await startPush()
    await workouts.discard(id)
    const router = renderSummary(id)
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
