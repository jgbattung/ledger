import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { programs } from '@/db/repos'
import { emptyDraft } from '@/programs/model'
import { ProgramEditorPage } from './ProgramEditorPage'
import { ExercisePickerPage } from './ExercisePickerPage'

export const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

export async function seedProgram(
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
  render(<RouterProvider router={router} />)
  return router
}
