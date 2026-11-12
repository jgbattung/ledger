import { Copy, Flame, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { SheetRow } from '@/components/ui/sheet-row'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * Exercise actions drawer (LG-006). Every row ships as a disabled Soon row, in
 * its final order: LG-054 enables the first three in place, LG-007 enables
 * Duplicate and Delete. Never re-sort the rows when enabling one.
 */
export function ExerciseActionsSheet({
  open,
  onOpenChange,
  name,
  isCustom,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  isCustom: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="max-h-[85svh] overflow-y-auto">
        <SheetHeader className="py-1.5 pr-1 pl-4">
          <SheetTitle className="min-w-0 truncate text-[15px] font-semibold">{name}</SheetTitle>
        </SheetHeader>
        <SheetRow icon={Timer} label="Rest timer" soon />
        <SheetRow icon={Flame} label="Warm-up sets" soon />
        <SheetRow icon={RotateCcw} label="Reset to defaults" soon />
        <SheetRow icon={Copy} label="Duplicate" soon />
        {isCustom ? <SheetRow icon={Trash2} label="Delete exercise" soon /> : null}
      </SheetContent>
    </Sheet>
  )
}
