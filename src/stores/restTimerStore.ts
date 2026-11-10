import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { playRestChime, unlockAudio, vibrateRestEnd } from '@/lib/restChime'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Rest timer (LG-017). The end time is a wall-clock timestamp: remaining time
 * is always derived from `Date.now()`, never from a running interval (TIM-4).
 * The session store is read lazily inside actions only, because it imports
 * this module.
 */
type RestTimerState = {
  workoutId: string | null
  /** ms epoch the rest ends at; null = idle. */
  endsAt: number | null
  /** Denominator for the draining tracks. */
  totalSeconds: number
  /** Settings default, pushed in by SessionPage. */
  defaultSeconds: number
  /** Called once each time a set is checked off. Restarts the timer. */
  onSetCompleted: (workoutExerciseId: string) => void
  /** Starts a rest of `seconds` for the in-progress workout. */
  start: (seconds: number) => void
  /** Preset pick: restart at `seconds` (total = seconds), also from idle. */
  setRemaining: (seconds: number) => void
  /** User action: end the rest now. */
  skip: () => void
  /** Lifecycle reset (finish, discard, reset). */
  clear: () => void
  setDefaultSeconds: (seconds: number) => void
  /** Drops a stored timer that is not this workout's or has expired. */
  reconcile: (workoutId: string | null) => void
}

const STORAGE_KEY = 'ledger-rest-timer'
const DEFAULT_REST_SECONDS = 180

type Stored = { workoutId: string; endsAt: number; totalSeconds: number }

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Stored> | null
    if (
      parsed &&
      typeof parsed.workoutId === 'string' &&
      typeof parsed.endsAt === 'number' &&
      typeof parsed.totalSeconds === 'number'
    ) {
      return { workoutId: parsed.workoutId, endsAt: parsed.endsAt, totalSeconds: parsed.totalSeconds }
    }
  } catch {
    // Unreadable storage: behave as if no timer was saved.
  }
  return null
}

function writeStored(value: Stored | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: the timer still works for this page load.
  }
}

/** Whole seconds left, rounded up, never below 0. */
export function restRemainingSeconds(endsAt: number | null, now: number): number {
  if (endsAt == null) return 0
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

const idleState = { workoutId: null, endsAt: null, totalSeconds: 0 }

function initialState() {
  const stored = readStored()
  return stored
    ? { workoutId: stored.workoutId, endsAt: stored.endsAt, totalSeconds: stored.totalSeconds }
    : idleState
}

let endHandle: ReturnType<typeof setTimeout> | undefined

function cancelEnd() {
  clearTimeout(endHandle)
  endHandle = undefined
}

export const useRestTimerStore = create<RestTimerState>()((set, get) => {
  function scheduleEnd() {
    cancelEnd()
    const scheduledFor = get().endsAt
    if (scheduledFor == null) return
    endHandle = setTimeout(
      () => {
        endHandle = undefined
        if (get().endsAt !== scheduledFor) return
        playRestChime()
        vibrateRestEnd()
        get().clear()
      },
      Math.max(0, scheduledFor - Date.now()),
    )
  }

  function begin(seconds: number) {
    unlockAudio()
    const workoutId = useSessionStore.getState().workout?.id
    if (!workoutId || seconds <= 0) return
    const endsAt = Date.now() + seconds * 1000
    set({ workoutId, endsAt, totalSeconds: seconds })
    writeStored({ workoutId, endsAt, totalSeconds: seconds })
    scheduleEnd()
  }

  function end() {
    cancelEnd()
    writeStored(null)
    set(idleState)
  }

  return {
    ...initialState(),
    defaultSeconds: DEFAULT_REST_SECONDS,

    onSetCompleted(workoutExerciseId) {
      const entry = useSessionStore
        .getState()
        .exercises.find((candidate) => candidate.exercise.id === workoutExerciseId)
      get().start(entry?.exercise.targetsSnapshot?.restSeconds ?? get().defaultSeconds)
    },

    start: begin,
    setRemaining: begin,
    skip: end,
    clear: end,

    setDefaultSeconds(seconds) {
      set({ defaultSeconds: seconds })
    },

    reconcile(workoutId) {
      const { workoutId: ownerId, endsAt } = get()
      if (endsAt == null) {
        writeStored(null)
        return
      }
      if (ownerId !== workoutId || endsAt <= Date.now()) {
        end()
        return
      }
      scheduleEnd()
    },
  }
})

/** Test-only: drop the pending timeout and re-run the module-load storage read. */
export function __resetRestTimerForTests() {
  cancelEnd()
  useRestTimerStore.setState({ ...initialState(), defaultSeconds: DEFAULT_REST_SECONDS })
}

// A hidden page may have frozen the end timeout: if the rest ended while away, drop it silently.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const { endsAt, clear } = useRestTimerStore.getState()
    if (endsAt != null && endsAt <= Date.now()) clear()
  })
}

/**
 * Live rest countdown for the UI. The 1 s interval only triggers a re-render
 * while a rest is running; the number itself comes from `endsAt`.
 */
export function useRestRemaining(): { remaining: number; total: number; resting: boolean } {
  const endsAt = useRestTimerStore((state) => state.endsAt)
  const total = useRestTimerStore((state) => state.totalSeconds)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (endsAt == null) return
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  const remaining = restRemainingSeconds(endsAt, Date.now())
  return { remaining, total, resting: remaining > 0 }
}
