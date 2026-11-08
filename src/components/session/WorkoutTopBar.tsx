import { useEffect, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { formatClock, formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRestTimerStore } from '@/stores/restTimerStore'

/** Filled stopwatch (design-system 10j). The hand is cut out in the surface colour. */
function Stopwatch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-4', className)}>
      <rect x="9.5" y="2" width="5" height="2.5" rx="1" fill="currentColor" />
      <rect x="11" y="4" width="2" height="3" fill="currentColor" />
      <path d="m18 6.5 1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="14" r="8" fill="currentColor" />
      <path
        d="M12 14V9.5"
        stroke="var(--background)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/**
 * Top bar of the Ongoing Workout (design-system 10j): flush Back, the muted
 * workout duration, the rest timer with a filled stopwatch, the menu button,
 * and a 4px rest-bar track that is always visible (empty while idle).
 */
export function WorkoutTopBar({
  startedAt,
  onBack,
  onMenu,
}: {
  startedAt: number
  onBack: () => void
  onMenu: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const remaining = useRestTimerStore((state) => state.remainingSeconds)
  const total = useRestTimerStore((state) => state.totalSeconds)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const idle = remaining <= 0
  const fill = total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0

  return (
    <header className="shrink-0">
      <div className="flex h-[52px] items-center px-4">
        <BackLink onBack={onBack} label="Back" />
        <span
          aria-label="Workout duration"
          className="-ml-3 text-[15px] text-muted-foreground tabular-nums"
        >
          {formatClock(now - startedAt)}
        </span>
        <span className="flex-1" />
        <span
          role="timer"
          aria-label="Rest timer"
          className={cn(
            'flex items-center gap-1 text-[15px] tabular-nums',
            idle ? 'font-medium text-muted-foreground' : 'font-semibold',
          )}
        >
          <Stopwatch />
          {formatSeconds(Math.max(0, remaining))}
        </span>
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
