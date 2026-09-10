import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SoonRow } from '@/components/SoonRow'

/**
 * The FAB's quick-action launcher (`.gsd/user-flows.md` §1). Wraps the existing
 * bottom-sheet primitive - no new dependency, no second sheet pattern.
 *
 * Every action is disabled in LG-049: none of the five destinations exists yet.
 * The rows ship in final approved order now so a later story enables its own row
 * in a one-line diff and never re-sorts the menu.
 */
const QUICK_ACTIONS = [
  'Start next workout',
  'Start new program',
  'Create exercise',
  'Log bodyweight',
  'Progress photo',
] as const

export function QuickActionSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
        </SheetHeader>
        <ul className="divide-y divide-border overflow-y-auto border-t border-border px-4 pb-2">
          {QUICK_ACTIONS.map((label) => (
            <li key={label}>
              <SoonRow label={label} />
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
