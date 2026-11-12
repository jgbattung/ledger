import type { ReactNode } from 'react'
import { Dumbbell } from 'lucide-react'
import { exerciseImageUrl } from '@/exercises/catalog'
import { formatFilterValue } from '@/exercises/filtering'
import type { Exercise } from '@/exercises/types'
import { cn } from '@/lib/utils'

/** Content-box height of a row: the 48px thumbnail. `contain-intrinsic-size`
 * sizes the content box, so with the `py-2` padding a skipped row is exactly as
 * tall as a rendered one (64px). A larger value makes the list's height change
 * as rows scroll in and out, which breaks scroll restoration (LG-006). */
const ROW_HEIGHT_PX = 48

/** Display row for one exercise (LG-005). It carries no navigation itself:
 * the Library wraps it in a `Link` to the detail page (LG-006); the pickers
 * wrap it in their own select controls. `content-visibility: auto` keeps the full
 * 873-row list smooth on mobile without a virtualization dependency.
 *
 * `trailing` renders after the text column (e.g. a remove button or a
 * selection check); `muted` greys the name and thumbnail for unavailable rows.
 * `subtitle` replaces the muscle/equipment meta line when given. */
export function ExerciseListItem({
  exercise,
  trailing,
  muted = false,
  subtitle,
}: {
  exercise: Exercise
  trailing?: ReactNode
  muted?: boolean
  subtitle?: ReactNode
}) {
  const meta = [
    exercise.primaryMuscles[0] ? formatFilterValue(exercise.primaryMuscles[0]) : null,
    exercise.equipment ? formatFilterValue(exercise.equipment) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  const secondLine = subtitle ?? meta

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
          className={cn('size-12 shrink-0 rounded-md bg-muted object-cover', muted && 'grayscale')}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted"
        >
          <Dumbbell className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-base', muted && 'text-muted-foreground')}>{exercise.name}</p>
        {secondLine ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{secondLine}</p>
        ) : null}
      </div>
      {trailing}
    </div>
  )
}
