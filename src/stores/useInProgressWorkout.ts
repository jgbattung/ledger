import { useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * The in-progress workout (or null), hydrating the session store on first use.
 * Hydration is idempotent per workout id, so any screen may call this.
 * `ready` is false until the first hydrate has settled.
 */
export function useInProgressWorkout() {
  const workout = useSessionStore((state) => state.workout)
  const ready = useSessionStore((state) => state.hydrated)
  useEffect(() => {
    void useSessionStore.getState().hydrate()
  }, [])
  return { workout, ready }
}
