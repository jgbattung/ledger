import { Dumbbell } from 'lucide-react'
import { exerciseImageUrl } from '@/exercises/catalog'
import { formatFilterValue } from '@/exercises/filtering'
import type { Exercise } from '@/exercises/types'

/** Fixed row height used for both the layout (`min-h-touch-primary` + this
 * padding) and the `content-visibility` perf hint below - keep the value in
 * this one place so they can't drift apart. */
const ROW_HEIGHT_PX = 72

/** Static display row for one exercise (LG-005). No link/onClick - LG-006
 * wraps rows in navigation. `content-visibility: auto` keeps the full
 * 873-row list smooth on mobile without a virtualization dependency. */
export function ExerciseListItem({ exercise }: { exercise: Exercise }) {
  const meta = [
    exercise.primaryMuscles[0] ? formatFilterValue(exercise.primaryMuscles[0]) : null,
    exercise.equipment ? formatFilterValue(exercise.equipment) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

  return (
    <div
      className="flex min-h-touch-primary items-center gap-3 py-2"
      style={{ contentVisibility: 'auto', containIntrinsicSize: `0 ${ROW_HEIGHT_PX}px` }}
    >
      {exercise.images.length > 0 ? (
        <img
          src={exerciseImageUrl(exercise.images[0])}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-12 shrink-0 rounded-md bg-muted object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted"
        >
          <Dumbbell className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-base">{exercise.name}</p>
        {meta ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  )
}
