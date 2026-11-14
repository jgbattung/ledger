import { useState } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  Navigate,
} from 'react-router-dom'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { MusclePickerPage } from '@/routes/MusclePickerPage'
import { CustomExerciseFormPage } from '@/routes/CustomExerciseFormPage'
import { AppShell, ChromelessShell } from '@/routes/AppShell'
import { DashboardPage } from '@/routes/DashboardPage'
import { WorkoutPage } from '@/routes/WorkoutPage'
import { LevelsPage } from '@/routes/LevelsPage'
import { MorePage } from '@/routes/MorePage'
import { LibraryPage } from '@/routes/LibraryPage'
import { SettingsPage } from '@/routes/SettingsPage'
import { ProgramEditorPage } from '@/routes/ProgramEditorPage'
import { ExercisePickerPage } from '@/routes/ExercisePickerPage'
import { DayPage } from '@/routes/DayPage'
import { SessionPage } from '@/routes/SessionPage'
import { SwapPickerPage } from '@/routes/SwapPickerPage'
import { ExerciseDetailPage } from '@/routes/ExerciseDetailPage'

function createAppRouter() {
  return createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="workout" element={<WorkoutPage />} />
          <Route path="levels" element={<LevelsPage />} />
          {/*
            `more/settings` and `more/library` are nested paths but NOT nested
            UI - they are siblings of the menu, so they must never render
            inside MorePage's row list.
          */}
          <Route path="more" element={<MorePage />} />
          <Route path="more/settings" element={<SettingsPage />} />
          <Route path="more/library" element={<LibraryPage />} />
        </Route>
        {/* Full-screen takeovers (LG-020 editor, LG-022 Day page, LG-010 Ongoing Workout) mount here. */}
        <Route element={<ChromelessShell />}>
          <Route path="programs/new" element={<ProgramEditorPage />} />
          <Route path="programs/new/exercises" element={<ExercisePickerPage />} />
          <Route path="programs/:programId" element={<ProgramEditorPage />} />
          <Route path="programs/:programId/exercises" element={<ExercisePickerPage />} />
          <Route path="programs/:programId/days/:dayId" element={<DayPage />} />
          <Route path="session" element={<SessionPage />} />
          <Route path="session/swap/:workoutExerciseId" element={<SwapPickerPage />} />
          <Route path="exercises/new" element={<CustomExerciseFormPage />} />
          <Route path="exercises/new/muscles" element={<MusclePickerPage />} />
          <Route path="exercises/custom/:id/edit" element={<CustomExerciseFormPage />} />
          <Route path="exercises/custom/:id/edit/muscles" element={<MusclePickerPage />} />
          <Route path="exercises/:source/:exerciseId" element={<ExerciseDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </>,
    ),
  )
}

function App() {
  // Created once per App mount (not at module scope) so tests that call
  // history.pushState before render still land on the intended route.
  const [router] = useState(createAppRouter)

  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  )
}

export default App
