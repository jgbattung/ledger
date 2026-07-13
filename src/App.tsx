import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from '@/settings/SettingsProvider'
import { AppShell } from '@/routes/AppShell'
import { TodayPage } from '@/routes/TodayPage'
import { LibraryPage } from '@/routes/LibraryPage'
import { ProgramsPage } from '@/routes/ProgramsPage'
import { ProgressPage } from '@/routes/ProgressPage'
import { SettingsPage } from '@/routes/SettingsPage'

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  )
}

export default App
