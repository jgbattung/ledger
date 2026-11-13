import { Copy, Flame, Pencil, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { SheetRow } from '@/components/ui/sheet-row'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * Exercise actions drawer (LG-006). Rows keep their final order: Rest timer,
 * Warm-up sets and Reset to defaults are still Soon rows (LG-054 enables them
 * in place); LG-007 added Edit (a live custom exercise), Duplicate (any
 * exercise) and Delete (a live custom exercise). Never re-sort the rows.
 */
export function ExerciseActionsSheet({
  open,
  onOpenChange,
  name,
  isCustom,
  deleted = false,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  isCustom: boolean
  /** A soft-deleted custom exercise: only Duplicate stays. */
  deleted?: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const editable = isCustom && !deleted
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="max-h-[85svh] overflow-y-auto">
        <SheetHeader className="py-1.5 pr-1 pl-4">
          <SheetTitle className="min-w-0 truncate text-[15px] font-semibold">{name}</SheetTitle>
        </SheetHeader>
        <SheetRow icon={Timer} label="Rest timer" soon />
        <SheetRow icon={Flame} label="Warm-up sets" soon />
        <SheetRow icon={RotateCcw} label="Reset to defaults" soon />
        {editable ? <SheetRow icon={Pencil} label="Edit exercise" onClick={onEdit} /> : null}
        <SheetRow icon={Copy} label="Duplicate" onClick={onDuplicate} />
        {editable ? <SheetRow icon={Trash2} label="Delete exercise" danger onClick={onDelete} /> : null}
      </SheetContent>
    </Sheet>
  )
}
