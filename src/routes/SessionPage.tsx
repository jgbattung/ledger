import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'

/** The Ongoing Workout (`/session`). Redirects when nothing is in progress. */
export function SessionPage() {
  const hydrated = useSessionStore((state) => state.hydrated)
  const workout = useSessionStore((state) => state.workout)

  useEffect(() => {
    void useSessionStore.getState().hydrate()
  }, [])

  if (!hydrated) return null
  if (!workout) return <Navigate to="/workout" replace />
  return <h1 className="px-4 pt-6 text-2xl font-semibold">{workout.name}</h1>
}
