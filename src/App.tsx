import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { AppShell, ChromelessShell } from '@/routes/AppShell'
import { DashboardPage } from '@/routes/DashboardPage'
import { WorkoutPage } from '@/routes/WorkoutPage'
import { LevelsPage } from '@/routes/LevelsPage'
import { MorePage } from '@/routes/MorePage'
import { LibraryPage } from '@/routes/LibraryPage'
import { SettingsPage } from '@/routes/SettingsPage'

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
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
          {/* Full-screen takeovers (LG-010) mount here. No children yet. */}
          <Route element={<ChromelessShell />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  )
}

export default App
