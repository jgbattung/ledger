import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Square } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'
import { useSessionStore } from '@/stores/sessionStore'
import { isPaused, workoutElapsedMs } from '@/workouts/model'

const ICON_BUTTON =
  'flex size-touch-min shrink-0 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Floating in-progress workout bar (design-system 11). Mounted by AppShell
 * only, so it never shows on full-screen routes. The body links to the
 * session; Pause/Play and Stop are sibling icon buttons, never nested in it.
 * Stop opens the shared discard confirm and leaves you on the current tab.
 */
export function WorkoutBar() {
  const { workout } = useInProgressWorkout()
  const exercises = useSessionStore((state) => state.exercises)
  const [now, setNow] = useState(() => Date.now())
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const paused = workout ? isPaused(workout) : false

  useEffect(() => {
    if (!workout || paused) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [workout, paused])

  if (!workout) return null

  const allSets = exercises.flatMap((entry) => entry.sets)
  const done = allSets.filter((row) => row.completedAt != null).length
  const store = useSessionStore.getState()

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-4 z-30 flex min-h-touch-primary items-center gap-1 rounded-lg border border-border bg-card pl-4 pr-1 shadow-sm dark:shadow-none',
          // Clears the FAB's top edge (nav height + raise) by 8px, above the gesture inset.
          'bottom-[calc(var(--touch-primary)+var(--fab-raise)+env(safe-area-inset-bottom)+0.5rem)]',
        )}
      >
        <Link
          to="/session"
          aria-label={`Open workout, ${workout.name}`}
          className="flex min-w-0 flex-1 flex-col justify-center self-stretch rounded-md py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="truncate text-sm font-semibold">{workout.name}</span>
          <span className="text-xs leading-snug text-muted-foreground tabular-nums">
            <span
              aria-label={paused ? 'Workout duration, paused' : 'Workout duration'}
              className={paused ? 'text-muted-foreground' : 'font-semibold text-foreground'}
            >
              {formatClock(workoutElapsedMs(workout, now))}
            </span>
            {` · ${done} of ${allSets.length} sets`}
          </span>
        </Link>
        <button
          type="button"
          aria-label={paused ? 'Resume workout timer' : 'Pause workout timer'}
          onClick={() => (paused ? store.resume() : store.pause())}
          className={ICON_BUTTON}
        >
          {paused ? (
            <Play className="size-5" aria-hidden="true" />
          ) : (
            <Pause className="size-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Discard workout"
          onClick={() => setConfirmDiscard(true)}
          className={ICON_BUTTON}
        >
          <Square className="size-4 fill-current" aria-hidden="true" />
        </button>
      </div>
      <ConfirmSheet
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this workout?"
        description="Nothing from it is saved to your history, and the program day stays as it was."
        confirmLabel="Discard workout"
        cancelLabel="Keep workout"
        tone="destructive"
        onConfirm={() => {
          setConfirmDiscard(false)
          void useSessionStore.getState().discard()
        }}
      />
    </>
  )
}
