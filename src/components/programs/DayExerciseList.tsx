import { Link } from 'react-router-dom'
import { Moon, Plus, X } from 'lucide-react'
import { ExerciseListItem } from '@/components/library/ExerciseListItem'
import { getExerciseById } from '@/exercises/catalog'
import { exerciseName, isRestDay } from '@/programs/model'
import type { DraftDay } from '@/programs/model'

const ADD_LINK =
  'flex min-h-touch-min items-center gap-1 rounded-md text-[15px] font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function NoTargets() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
      No targets yet
    </span>
  )
}

/**
 * Exercise section of the selected day: the count header with "Add exercises",
 * one row per exercise (44px remove), or the rest-day card for an empty day.
 * Rows are not tappable until the targets drawer lands (LG-052).
 */
export function DayExerciseList({
  day,
  addHref,
  onRemove,
}: {
  day: DraftDay
  addHref: string
  onRemove: (exerciseId: string) => void
}) {
  if (isRestDay(day)) {
    return (
      <div className="mt-[18px] flex flex-col items-center">
        <div className="flex w-full flex-col items-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-border px-[18px] pt-5 pb-3 text-center">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Moon className="size-5" aria-hidden="true" />
          </span>
          <p className="font-semibold">Rest day</p>
          <p className="text-sm text-muted-foreground">
            A day with no exercises is a rest day. Add exercises to turn it into a workout day.
          </p>
          <Link to={addHref} className={ADD_LINK}>
            <Plus className="size-4" aria-hidden="true" />
            Add exercises
          </Link>
        </div>
      </div>
    )
  }

  const count = day.exercises.length
  return (
    <section aria-label="Exercises">
      <div className="mt-[18px] mb-0.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold tabular-nums">
          {count} {count === 1 ? 'exercise' : 'exercises'}
        </h2>
        <Link to={addHref} className={ADD_LINK}>
          <Plus className="size-4" aria-hidden="true" />
          Add exercises
        </Link>
      </div>
      <ul className="divide-y divide-border border-b border-border">
        {day.exercises.map((exercise) => {
          const name = exerciseName(exercise.exerciseRef)
          const catalog =
            exercise.exerciseRef.source === 'db' ? getExerciseById(exercise.exerciseRef.exerciseId) : undefined
          const remove = (
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(exercise.id)}
              className="-mr-3 flex size-touch-min shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )
          return (
            <li key={exercise.id}>
              {catalog ? (
                <ExerciseListItem exercise={catalog} trailing={remove} subtitle={<NoTargets />} />
              ) : (
                <div className="flex min-h-touch-primary items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base">{name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      <NoTargets />
                    </p>
                  </div>
                  {remove}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
