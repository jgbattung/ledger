import { useEffect, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { Stopwatch } from '@/components/session/Stopwatch'
import { formatClock, formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Workout } from '@/db/types'
import { useRestRemaining } from '@/stores/restTimerStore'
import { isPaused, workoutElapsedMs } from '@/workouts/model'

/**
 * Top bar of the Ongoing Workout (design-system 10j): flush Back, the workout
 * duration (ink while running, muted while paused), the rest timer button (opens the rest
 * sheet) with a filled stopwatch, the menu button, and a 4px rest-bar track that is always visible (empty while idle).
 */
export function WorkoutTopBar({
  workout,
  onBack,
  onMenu,
  onRestTimer,
}: {
  workout: Pick<Workout, 'startedAt' | 'pausedAt' | 'pausedMs'>
  onBack: () => void
  onMenu: () => void
  onRestTimer: () => void
}) {
  const paused = isPaused(workout)
  const [now, setNow] = useState(() => Date.now())
  const { remaining, total, resting } = useRestRemaining()

  useEffect(() => {
    if (paused) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [paused])

  const idle = !resting
  const fill = total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0

  return (
    <header className="shrink-0">
      <div className="flex h-[52px] items-center px-4">
        <BackLink onBack={onBack} label="Back" />
        <span
          aria-label={paused ? 'Workout duration, paused' : 'Workout duration'}
          className={cn(
            '-ml-3 text-[15px] tabular-nums',
            paused ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {formatClock(workoutElapsedMs(workout, now))}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={idle ? 'Rest timer, not running' : `Rest timer, ${formatSeconds(remaining)} left`}
          onClick={onRestTimer}
          className={cn(
            '-mx-2 flex min-h-touch-min items-center gap-1 rounded-md px-2 text-[15px] tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            idle ? 'font-medium text-muted-foreground' : 'font-semibold',
          )}
        >
          <Stopwatch />
          {formatSeconds(remaining)}
        </button>
        <button
          type="button"
          aria-label="Workout menu"
          onClick={onMenu}
          className="flex size-touch-min items-center justify-end rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <EllipsisVertical className="-mr-[5px] size-5" aria-hidden="true" />
        </button>
      </div>
      <div aria-hidden="true" className="h-1 bg-secondary">
        <span className="block h-full rounded-r-sm bg-foreground" style={{ width: `${fill}%` }} />
      </div>
    </header>
  )
}
