import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { ExerciseThumb } from '@/components/ExerciseThumb'
import { exerciseName } from '@/programs/model'
import type { SessionExercise } from '@/stores/sessionStore'

/**
 * One image tile per exercise (design-system 10i). Tapping a tile focuses it.
 * A single indicator bar glides to the focused tile (transform only) and the
 * strip scrolls the focused tile into view (design-system 10l).
 */
export function ExerciseStrip({
  exercises,
  focusedId,
  onFocus,
}: {
  exercises: SessionExercise[]
  focusedId: string | null
  onFocus: (workoutExerciseId: string) => void
}) {
  const strip = useRef<HTMLElement>(null)
  const focusedIndex = exercises.findIndex((entry) => entry.exercise.id === focusedId)

  useEffect(() => {
    const container = strip.current
    const tile = container?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!container || !tile) return
    const left = tile.offsetLeft
    const right = left + tile.offsetWidth
    if (left >= container.scrollLeft && right <= container.scrollLeft + container.clientWidth) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    container.scrollTo?.({
      left: left - (container.clientWidth - tile.offsetWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [focusedId])

  return (
    <nav
      ref={strip}
      aria-label="Exercises"
      className="flex shrink-0 overflow-x-auto px-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="relative flex gap-1.5">
        {exercises.map(({ exercise, sets }) => {
          const focused = exercise.id === focusedId
          const done = sets.length > 0 && sets.every((set) => set.completedAt != null)
          return (
            <button
              key={exercise.id}
              type="button"
              aria-label={`${exerciseName(exercise.exerciseRef)}${done ? ', all sets done' : ''}`}
              aria-current={focused ? 'true' : undefined}
              onClick={() => onFocus(exercise.id)}
              className="relative flex w-14 shrink-0 flex-col gap-1.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ExerciseThumb exerciseRef={exercise.exerciseRef} className="size-14 rounded-lg" />
              {done ? (
                <span
                  aria-hidden="true"
                  className="pop-in absolute top-1 right-1 flex size-[18px] items-center justify-center rounded-full bg-foreground text-background"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
              <span aria-hidden="true" className="h-[3px]" />
            </button>
          )
        })}
        {focusedIndex >= 0 ? (
          <span
            aria-hidden="true"
            data-testid="strip-indicator"
            className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-14 rounded-full bg-foreground transition-transform duration-(--duration-glide) ease-out-app"
            style={{ transform: `translateX(calc(${focusedIndex} * (3.5rem + 0.375rem)))` }}
          />
        ) : null}
      </div>
    </nav>
  )
}
