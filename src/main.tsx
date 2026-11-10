import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_NAME } from './config/app'

document.title = APP_NAME

// Request persistent storage so the offline-precached exercise dataset and
// images survive storage pressure eviction (PRD §2.2).
navigator.storage?.persist?.().catch(() => {})

async function boot() {
  // Dev-only seeded environments (`npm run dev:seed`). Vite replaces the mode
  // statically, so this branch and its import are dropped from production builds.
  const mode = import.meta.env.MODE
  if (mode === 'seed' || mode === 'seed-fresh') {
    const { ensureSeeded } = await import('@/db/seed')
    await ensureSeeded({ fresh: mode === 'seed-fresh', runId: __SEED_RUN_ID__ })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
