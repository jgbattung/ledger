import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatSeconds } from '@/lib/format'
import { repPlaceholder } from '@/workouts/model'
import type { TargetsSnapshot } from '@/db/types'

function rows(snapshot: TargetsSnapshot | undefined): [string, string][] {
  if (!snapshot) return []
  const out: [string, string][] = []
  if (snapshot.workingSets !== undefined) out.push(['Working sets', `${snapshot.workingSets}`])
  const reps = repPlaceholder(snapshot)
  if (reps) out.push(['Reps', reps])
  if (snapshot.rirTarget !== undefined) out.push(['RIR', `${snapshot.rirTarget}`])
  if (snapshot.restSeconds !== undefined) out.push(['Rest', formatSeconds(snapshot.restSeconds)])
  if (snapshot.warmupSetCount !== undefined) out.push(['Warm-up sets', `${snapshot.warmupSetCount}`])
  if (snapshot.notes) out.push(['Program note', snapshot.notes])
  return out
}

/** Read-only view of the targets snapshotted when the workout started. */
export function TargetsSheet({
  open,
  onOpenChange,
  exerciseName,
  snapshot,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseName: string
  snapshot: TargetsSnapshot | undefined
}) {
  const list = rows(snapshot)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle>Targets</SheetTitle>
            <SheetDescription className="truncate">{exerciseName}</SheetDescription>
          </div>
        </SheetHeader>
        {list.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-sm text-muted-foreground">
            No targets. This exercise started with 1 blank set.
          </p>
        ) : (
          <dl className="divide-y divide-border overflow-y-auto border-t border-border px-4 pb-2">
            {list.map(([label, value]) => (
              <div key={label} className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}
