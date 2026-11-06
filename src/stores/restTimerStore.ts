import { create } from 'zustand'

/**
 * Rest-timer seam. This story ships the display (`0:00`), the empty bar track
 * and the `onSetCompleted` call from the session store. LG-017 implements the
 * countdown, the ding and the Wake Lock here, without touching the callers.
 */
type RestTimerState = {
  remainingSeconds: number
  totalSeconds: number
  /** Called once each time a set is checked off. A no-op until LG-017. */
  onSetCompleted: (workoutExerciseId: string) => void
}

export const useRestTimerStore = create<RestTimerState>(() => ({
  remainingSeconds: 0,
  totalSeconds: 0,
  onSetCompleted: () => {},
}))
