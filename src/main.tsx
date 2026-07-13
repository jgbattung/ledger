import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_NAME } from './config/app'

document.title = APP_NAME

// Request persistent storage so the offline-precached exercise dataset and
// images survive storage pressure eviction (PRD §2.2).
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
