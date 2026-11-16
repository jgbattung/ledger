import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { exercisePath } from '@/exercises/detail'
import type { ListedExercise } from '@/exercises/listing'
import { cn } from '@/lib/utils'

/**
 * One result row of an exercise picker, with two tap zones: the name and image
 * open the exercise page (so you can read about it before choosing), and the
 * trailing circle selects. The circle is drawn 28px inside a 44px hit area.
 *
 * `multi` rows show the add order inside a picked circle (`order` is the 1-based
 * position, 0 when not picked); single-choice rows have no number and no
 * pressed state. A `disabled` row keeps its link but cannot be selected.
 */
export function PickerRow({
  exercise,
  multi,
  order = 0,
  disabled = false,
  subtitle,
  onSelect,
}: {
  exercise: ListedExercise
  multi: boolean
  order?: number
  disabled?: boolean
  subtitle?: ReactNode
  onSelect: () => void
}) {
  const picked = order > 0
  return (
    <div className="flex items-center">
      <Link
        to={exercisePath(exercise.ref)}
        className="block min-w-0 flex-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ExerciseListItem exercise={exercise} muted={disabled} subtitle={subtitle} />
      </Link>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={multi && !disabled ? picked : undefined}
        aria-label={`${picked ? 'Deselect' : 'Select'} ${exercise.name}`}
        onClick={onSelect}
        className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums',
            picked
              ? 'border-primary bg-primary text-primary-foreground'
              : disabled
                ? 'border-dashed border-border'
                : 'border-border',
          )}
        >
          {multi && picked ? order : null}
        </span>
      </button>
    </div>
  )
}
