import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const BUTTON =
  'flex h-12 w-full items-center justify-center rounded-md px-3 text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none'

/**
 * Keep / Reset choice after picking a replacement exercise (LOG-10). Closing
 * the sheet cancels the swap. `keepSummary` is the snapshot's targets line
 * ("3 × 10–12 · RIR 1") or null when the exercise has none.
 */
export function SwapModeSheet({
  open,
  onOpenChange,
  toName,
  fromName,
  keepSummary,
  busy,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toName: string
  fromName: string
  keepSummary: string | null
  busy?: boolean
  onChoose: (mode: 'keep' | 'reset') => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle className="truncate">Swap to {toName}</SheetTitle>
            <SheetDescription className="text-xs">Replaces {fromName} for today</SheetDescription>
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('keep')}
            className={cn(BUTTON, 'bg-primary text-primary-foreground hover:bg-primary/90')}
          >
            {keepSummary ? `Keep targets · ${keepSummary}` : 'Keep targets'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('reset')}
            className={cn(BUTTON, 'bg-secondary text-secondary-foreground hover:bg-secondary/80')}
          >
            Reset targets
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
