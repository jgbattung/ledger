import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { programs } from '@/db/repos'
import { emptyDraft } from '@/programs/model'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { ProgramEditorPage } from './ProgramEditorPage'
import { ExercisePickerPage } from './ExercisePickerPage'

export const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

/** Complete targets, so seeded programs can be activated (LG-052). */
const SEEDED_TARGETS = { workingSets: 3, repMin: 8, repMax: 12 }

/** Exercises are seeded with complete targets unless `targets: false`. */
export async function seedProgram(
  name: string,
  days: { name: string; ids: string[] }[],
  opts: { activate?: boolean; archive?: boolean; targets?: boolean } = {},
) {
  const draft = emptyDraft()
  draft.name = name
  draft.days = days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.ids.map((id) => ({
      id: crypto.randomUUID(),
      exerciseRef: ref(id),
      ...(opts.targets === false ? {} : SEEDED_TARGETS),
    })),
  }))
  const id = await programs.saveTree(draft, { activate: opts.activate })
  if (opts.archive) await programs.archive(id)
  return id
}

export function renderEditor(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/workout', element: <p>Workout tab</p> },
      { path: '/programs/new', element: <ProgramEditorPage /> },
      { path: '/programs/new/exercises', element: <ExercisePickerPage /> },
      { path: '/programs/:programId', element: <ProgramEditorPage /> },
      { path: '/programs/:programId/exercises', element: <ExercisePickerPage /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>,
  )
  return router
}
