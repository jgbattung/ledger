import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SoonRow } from '@/components/SoonRow'
import { MenuLinkRow } from '@/components/MenuLinkRow'

/**
 * The FAB's quick-action launcher (`.gsd/user-flows.md` §1). Wraps the existing
 * bottom-sheet primitive - no new dependency, no second sheet pattern.
 *
 * "Start new program" is live since LG-020; the other four stay disabled until
 * their destinations exist. The rows ship in final approved order now so a later story enables its own row
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
              {label === 'Start new program' ? (
                <MenuLinkRow to="/programs/new" label={label} onClick={() => onOpenChange(false)} />
              ) : (
                <SoonRow label={label} />
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
