import { Link } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'

/** h:mm since `startedAt`, e.g. "0:31". */
function formatElapsed(startedAt: number, at: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((at - startedAt) / 60000))
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Replaces the up-next card on the Dashboard while a workout is running
 * (LOG-1a): the same shape, ending in an ink Resume workout.
 */
export function InProgressCard() {
  const workout = useSessionStore((state) => state.workout)
  const exercises = useSessionStore((state) => state.exercises)
  if (!workout) return null
  const all = exercises.flatMap((entry) => entry.sets)
  const done = all.filter((set) => set.completedAt != null).length

  return (
    <section
      aria-label="Workout in progress"
      className="mt-6 overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="px-3.5 pt-3.5">
        <p className="text-xs font-medium text-muted-foreground">
          In progress · started {formatElapsed(workout.startedAt)} ago
        </p>
        <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{workout.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {done} of {all.length} sets done
        </p>
      </div>
      <div className="p-3.5">
        <Link
          to="/session"
          className="flex h-touch-primary w-full items-center justify-center rounded-lg bg-foreground text-base font-medium text-background outline-none transition-colors hover:bg-foreground/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Resume workout
        </Link>
      </div>
    </section>
  )
}
