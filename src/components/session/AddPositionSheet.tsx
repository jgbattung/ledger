import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { ExerciseThumb } from '@/components/ExerciseThumb'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { InsertPosition } from '@/db/repos/workoutExercises'
import { exerciseName } from '@/programs/model'
import { cn } from '@/lib/utils'
import type { SessionExercise } from '@/stores/sessionStore'

const ROW =
  'flex min-h-12 w-full items-center gap-3 border-t border-border px-4 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50'

/** "All sets done" / "Current · 1 of 3 sets done" / "2 of 3 sets done" / "Not started". */
function progress({ sets }: SessionExercise, current: boolean): string {
  const done = sets.filter((set) => set.completedAt != null).length
  if (sets.length > 0 && done === sets.length) return 'All sets done'
  if (done === 0) return current ? 'Current · Not started' : 'Not started'
  const text = `${done} of ${sets.length} sets done`
  return current ? `Current · ${text}` : text
}

function PositionRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <li>
      <button type="button" aria-pressed={selected} onClick={onClick} className={ROW}>
        {children}
        {selected ? (
          <Check className="size-4 shrink-0 text-foreground" strokeWidth={2.5} aria-hidden="true" />
        ) : null}
      </button>
    </li>
  )
}

/**
 * Where the exercises picked on the add picker go: at the start, after any
 * exercise of the workout, or at the end. Picking a row closes the sheet;
 * nothing is written until the picker's Add button.
 */
export function AddPositionSheet({
  open,
  onOpenChange,
  exercises,
  focusedId,
  value,
  onSelect,
  formatProgress = progress,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: SessionExercise[]
  focusedId: string | null
  value: InsertPosition
  onSelect: (position: InsertPosition) => void
  /** The per-row progress line; the live session's wording by default. */
  formatProgress?: (entry: SessionExercise, current: boolean) => string
}) {
  const pick = (position: InsertPosition) => {
    onSelect(position)
    onOpenChange(false)
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle>Where should they go?</SheetTitle>
            <SheetDescription>Added in the order you picked them.</SheetDescription>
          </div>
        </SheetHeader>
        <ul className="overflow-y-auto">
          <PositionRow selected={value.kind === 'start'} onClick={() => pick({ kind: 'start' })}>
            <span className={cn('min-w-0 flex-1', value.kind === 'start' && 'font-semibold')}>
              At the start
            </span>
          </PositionRow>
          {exercises.map((entry) => {
            const selected =
              value.kind === 'after' && value.workoutExerciseId === entry.exercise.id
            return (
              <PositionRow
                key={entry.exercise.id}
                selected={selected}
                onClick={() => pick({ kind: 'after', workoutExerciseId: entry.exercise.id })}
              >
                <ExerciseThumb exerciseRef={entry.exercise.exerciseRef} className="size-8 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', selected && 'font-semibold')}>
                    After {exerciseName(entry.exercise.exerciseRef)}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {formatProgress(entry, entry.exercise.id === focusedId)}
                  </span>
                </span>
              </PositionRow>
            )
          })}
          <PositionRow selected={value.kind === 'end'} onClick={() => pick({ kind: 'end' })}>
            <span className={cn('min-w-0 flex-1', value.kind === 'end' && 'font-semibold')}>
              At the end
            </span>
          </PositionRow>
        </ul>
      </SheetContent>
    </Sheet>
  )
}
