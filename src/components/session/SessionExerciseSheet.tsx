import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SheetRow } from '@/components/ui/sheet-row'
import { exerciseName } from '@/programs/model'
import { useSessionStore } from '@/stores/sessionStore'
import type { SessionExercise } from '@/stores/sessionStore'

/**
 * The More sheet of one exercise in the live workout: actions that change
 * only this workout, never the program. Today that is Remove, behind a
 * destructive confirm. The only exercise left cannot be removed: the sheet
 * says why instead of opening the confirm.
 *
 * `entry` is a snapshot taken when the sheet opened, so the sheets can still
 * animate closed after the exercise is gone from the session.
 */
export function SessionExerciseSheet({
  open,
  onOpenChange,
  entry,
  isOnly,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: SessionExercise
  isOnly: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const name = exerciseName(entry.exercise.exerciseRef)
  const logged = entry.sets.filter((set) => set.completedAt != null).length

  useEffect(() => {
    if (!open) setHint(false)
  }, [open])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <div className="min-w-0">
              <SheetTitle className="truncate">{name}</SheetTitle>
              <SheetDescription>Changes apply to this workout only.</SheetDescription>
            </div>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SheetRow
              icon={Trash2}
              label="Remove exercise"
              danger
              onClick={() => {
                if (isOnly) {
                  setHint(true)
                  return
                }
                onOpenChange(false)
                setConfirmOpen(true)
              }}
            />
            {hint ? (
              <p
                role="status"
                className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground"
              >
                This is the only exercise. To stop, discard the workout from the ⋮ menu.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${name}?`}
        description={
          logged > 0
            ? `Its ${logged} logged ${logged === 1 ? 'set is' : 'sets are'} removed from this workout too.`
            : "It's removed from this workout. The program isn't changed."
        }
        confirmLabel="Remove exercise"
        cancelLabel="Keep exercise"
        tone="destructive"
        onConfirm={() => {
          setConfirmOpen(false)
          void useSessionStore
            .getState()
            .removeExercise(entry.exercise.id)
            .catch(() => {})
        }}
      />
    </>
  )
}
