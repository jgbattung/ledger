import { Check } from 'lucide-react'
import { ExerciseThumb } from '@/components/ExerciseThumb'
import { exerciseName } from '@/programs/model'
import { cn } from '@/lib/utils'
import type { SessionExercise } from '@/stores/sessionStore'

/** One image tile per exercise (design-system 10i). Tapping a tile focuses it. */
export function ExerciseStrip({
  exercises,
  focusedId,
  onFocus,
}: {
  exercises: SessionExercise[]
  focusedId: string | null
  onFocus: (workoutExerciseId: string) => void
}) {
  return (
    <nav
      aria-label="Exercises"
      className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
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
                className="absolute top-1 right-1 flex size-[18px] items-center justify-center rounded-full bg-foreground text-background"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={cn('h-[3px] rounded-full', focused ? 'bg-foreground' : 'bg-transparent')}
            />
          </button>
        )
      })}
    </nav>
  )
}
