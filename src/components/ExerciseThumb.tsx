import { Dumbbell } from 'lucide-react'
import { exerciseImageUrl, getExerciseById } from '@/exercises/catalog'
import type { ExerciseRef } from '@/db/types'
import { cn } from '@/lib/utils'

/** Exercise image tile with a dumbbell placeholder. `className` sets size and radius. */
export function ExerciseThumb({
  exerciseRef,
  className,
}: {
  exerciseRef: ExerciseRef
  className?: string
}) {
  const exercise = exerciseRef.source === 'db' ? getExerciseById(exerciseRef.exerciseId) : undefined
  const image = exercise?.images[0]
  return image ? (
    <img
      src={exerciseImageUrl(image)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 bg-muted object-cover', className)}
    />
  ) : (
    <div
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center bg-muted', className)}
    >
      <Dumbbell className="size-5 text-muted-foreground" />
    </div>
  )
}
