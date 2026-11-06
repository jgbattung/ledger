import { Plus } from 'lucide-react'
import { ROW_GRID, SetRow } from '@/components/session/SetRow'
import { repPlaceholder } from '@/workouts/model'
import type { Set as SetRecord, TargetsSnapshot } from '@/db/types'
import type { PadEntry, PadField } from '@/workouts/model'

/** The working-set table for one exercise (design-system 10a). Warm-ups never appear here. */
export function SetTable({
  sets,
  previous,
  snapshot,
  pad,
  onOpenPad,
  onToggle,
  onAddSet,
}: {
  sets: SetRecord[]
  previous: SetRecord[]
  snapshot: TargetsSnapshot | undefined
  pad: { setId: string; entry: PadEntry } | null
  onOpenPad: (setId: string, field: PadField) => void
  onToggle: (setId: string) => void
  onAddSet: () => void
}) {
  const placeholder = repPlaceholder(snapshot)
  return (
    <div className="px-4 pt-1.5">
      <div role="table" aria-label="Sets">
        <div
          role="row"
          className={`${ROW_GRID} min-h-[30px] text-xs font-medium text-muted-foreground`}
        >
          <span role="columnheader">Set</span>
          <span role="columnheader">Previous</span>
          <span role="columnheader" className="text-center">
            kg
          </span>
          <span role="columnheader" className="text-center">
            Reps
          </span>
          <span role="columnheader" className="sr-only">
            Done
          </span>
        </div>
        {sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            number={index + 1}
            previous={previous[index]}
            placeholder={placeholder}
            pad={pad?.setId === set.id ? pad.entry : null}
            onOpenPad={(field) => onOpenPad(set.id, field)}
            onToggle={() => onToggle(set.id)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add set
      </button>
    </div>
  )
}
