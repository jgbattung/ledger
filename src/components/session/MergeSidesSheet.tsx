import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const BUTTON =
  'flex h-12 w-full items-center justify-center rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Confirm for turning L/R off while some set's sides differ (design-system
 * 10o). Nothing is deleted, only merged, so the confirm is ink, not red.
 */
export function MergeSidesSheet({
  open,
  onOpenChange,
  setNumber,
  weight,
  reps,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 1-based number of the first set whose sides differ. */
  setNumber: number
  /** What that set becomes once merged. */
  weight: number
  reps: number
  onConfirm: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex flex-col gap-1 px-4 pb-2 pt-4">
          <SheetTitle className="text-base font-semibold">Log both sides together?</SheetTitle>
          <SheetDescription>
            {`Sets where your sides differ keep the heavier side: set ${setNumber} becomes ${weight} kg × ${reps}. You can't undo this.`}
          </SheetDescription>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className={cn(BUTTON, 'bg-foreground text-background hover:bg-foreground/90')}
          >
            Log both sides together
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(BUTTON, 'bg-secondary text-secondary-foreground hover:bg-accent')}
          >
            Keep L/R
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
