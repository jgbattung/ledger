import { useRef } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Confirmation bottom sheet. Two stacked 48px buttons: the confirm action on
 * top, cancel below.
 *
 * Destructive fill (recorded in design-system.md): light = solid red + white
 * text (4.65:1); dark = red-tinted fill + `destructive-tint-foreground` text
 * (6.10:1) - red text on black reads as harsh, so the fill carries the tone.
 */
type ConfirmSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  tone: 'destructive' | 'neutral'
  onConfirm: () => void
}

const BUTTON =
  'flex h-12 w-full items-center justify-center rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  onConfirm,
}: ConfirmSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onOpenAutoFocus={(event) => {
          // Never land focus on a destructive confirm.
          if (tone === 'destructive') {
            event.preventDefault()
            cancelRef.current?.focus()
          }
        }}
      >
        <div className="flex flex-col gap-1 px-4 pb-2 pt-4">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            data-tone={tone}
            className={cn(
              BUTTON,
              tone === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:border dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive-tint-foreground dark:hover:bg-destructive/25'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            ref={cancelRef}
            onClick={() => onOpenChange(false)}
            className={cn(BUTTON, 'bg-secondary text-secondary-foreground hover:bg-accent')}
          >
            {cancelLabel}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
