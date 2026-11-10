import { useCallback, useState } from 'react'
import { Stopwatch } from '@/components/session/Stopwatch'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRestRemaining, useRestTimerStore } from '@/stores/restTimerStore'
import { useSessionStore } from '@/stores/sessionStore'

const STEP = 15
const PRESETS = Array.from({ length: 12 }, (_, index) => (index + 1) * STEP)

/** The preset closest to `seconds`, so the strip opens near where the rest is. */
function nearestPreset(seconds: number) {
  return PRESETS.reduce((best, preset) =>
    Math.abs(preset - seconds) < Math.abs(best - seconds) ? preset : best,
  )
}

/**
 * Rest sheet (design-system 10m), opened from the top-bar timer. The time,
 * a free-scrolling strip of presets and Skip. The strip is native scrolling
 * only: no snap, no drag script, and it is positioned once when the sheet
 * opens and never moved by code again.
 */
export function RestTimerSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { remaining, resting } = useRestRemaining()
  const [tapped, setTapped] = useState<number | null>(null)

  // Runs once per open (the sheet content mounts then): a single instant scroll.
  const placeStrip = useCallback((strip: HTMLDivElement | null) => {
    if (!strip) return
    const { endsAt, defaultSeconds } = useRestTimerStore.getState()
    const session = useSessionStore.getState()
    const focused = session.exercises.find((entry) => entry.exercise.id === session.focusedExerciseId)
    const anchor =
      endsAt != null
        ? Math.ceil((endsAt - Date.now()) / 1000)
        : (focused?.exercise.targetsSnapshot?.restSeconds ?? defaultSeconds)
    const pill = strip.querySelector<HTMLElement>(`[data-seconds="${nearestPreset(anchor)}"]`)
    if (!pill) return
    strip.scrollLeft = pill.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) setTapped(null)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent aria-describedby={undefined} className="px-4 pb-4 pt-3">
        <SheetTitle className="sr-only">Rest timer</SheetTitle>
        <div
          aria-live="off"
          className={cn(
            'flex items-center justify-center gap-2 text-[44px] font-semibold leading-tight tabular-nums',
            resting ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Stopwatch className="size-7" cutout="var(--card)" />
          {formatSeconds(remaining)}
        </div>
        <div
          ref={placeStrip}
          role="group"
          aria-label="Rest time presets"
          className="relative -mx-4 mt-2 mb-1.5 flex gap-1.5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent_0,#000_16px,#000_calc(100%-32px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PRESETS.map((seconds) => {
            const label = formatSeconds(seconds)
            return (
              <button
                key={seconds}
                type="button"
                data-seconds={seconds}
                aria-label={`Rest ${label}`}
                aria-pressed={resting && tapped === seconds}
                onClick={() => {
                  setTapped(seconds)
                  useRestTimerStore.getState().setRemaining(seconds)
                }}
                className="group flex h-touch-min shrink-0 items-center outline-none"
              >
                <span
                  className={cn(
                    'flex h-[34px] min-w-[54px] items-center justify-center rounded-full border border-border bg-background px-2.5 text-[13px] font-medium tabular-nums transition-colors',
                    'group-active:bg-accent group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
                    'group-aria-pressed:border-foreground group-aria-pressed:bg-foreground group-aria-pressed:text-background',
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          disabled={!resting}
          onClick={() => {
            useRestTimerStore.getState().skip()
            handleOpenChange(false)
          }}
          className={cn(
            'mt-2 flex h-touch-primary w-full items-center justify-center rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
            resting
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'border border-dashed border-border bg-background text-muted-foreground',
          )}
        >
          Skip rest
        </button>
      </SheetContent>
    </Sheet>
  )
}
