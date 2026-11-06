import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SoonRow } from '@/components/SoonRow'
import { MenuLinkRow } from '@/components/MenuLinkRow'
import { programs } from '@/db/repos'
import { nextWorkoutDay, programTreeToDraft } from '@/programs/model'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

/**
 * The FAB's quick-action launcher (`.gsd/user-flows.md` §1). Wraps the existing
 * bottom-sheet primitive - no new dependency, no second sheet pattern.
 *
 * "Start new program" is live since LG-020 and "Start next workout" since
 * LG-022; the other three stay disabled until their destinations exist. The
 * rows ship in final approved order now so a later story enables its own row
 * in a one-line diff and never re-sorts the menu.
 */
const QUICK_ACTIONS = [
  'Start next workout',
  'Start new program',
  'Create exercise',
  'Log bodyweight',
  'Progress photo',
] as const

/**
 * Where "Start next workout" goes: the active program's up-next Day page, or
 * the Workout tab when there is no active program (or nothing to start).
 */
function useStartNextTarget(open: boolean): string {
  const [target, setTarget] = useState('/workout')
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void programs.listTrees().then((trees) => {
      if (cancelled) return
      const active = trees.find((tree) => tree.program.isActive && !tree.program.isArchived)
      const day = active
        ? nextWorkoutDay(programTreeToDraft(active).days, active.program.completedDayIds)
        : null
      setTarget(active && day ? `/programs/${active.program.id}/days/${day.id}` : '/workout')
    })
    return () => {
      cancelled = true
    }
  }, [open])
  return target
}

export function QuickActionSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { workout } = useInProgressWorkout()
  const startNextTarget = useStartNextTarget(open)
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
        </SheetHeader>
        <ul className="divide-y divide-border overflow-y-auto border-t border-border px-4 pb-2">
          {QUICK_ACTIONS.map((label) => (
            <li key={label}>
              {label === 'Start next workout' ? (
                workout ? (
                  <MenuLinkRow to="/session" label="Resume workout" onClick={close} />
                ) : (
                  <MenuLinkRow to={startNextTarget} label={label} onClick={close} />
                )
              ) : label === 'Start new program' ? (
                <MenuLinkRow to="/programs/new" label={label} onClick={close} />
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
