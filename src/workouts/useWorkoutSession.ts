import { useEffect, useState } from 'react'
import { workouts } from '@/db/repos'
import type { WorkoutSession } from '@/db/repos'

export type WorkoutSessionState =
  | { status: 'loading' }
  /** Unknown, deleted or discarded: the page redirects to the Dashboard. */
  | { status: 'missing' }
  /** Still being logged: the page redirects to the Ongoing Workout. */
  | { status: 'in_progress' }
  | { status: 'ready'; session: WorkoutSession }

/**
 * Loads a finished workout for the summary and share pages (LG-014) and says
 * which redirect applies when it is not one. Local Dexie, so `loading` is
 * tens of milliseconds and pages render nothing during it.
 */
export function useWorkoutSession(id: string | undefined): WorkoutSessionState {
  const [state, setState] = useState<WorkoutSessionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<WorkoutSessionState> => {
      const workout = id ? await workouts.get(id) : undefined
      if (!workout || workout.status === 'discarded') return { status: 'missing' }
      if (workout.status === 'in_progress') return { status: 'in_progress' }
      const session = await workouts.loadSession(workout.id)
      return session ? { status: 'ready', session } : { status: 'missing' }
    }
    void load().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  return state
}
