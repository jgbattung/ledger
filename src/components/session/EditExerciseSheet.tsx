import { useEffect, useState } from 'react'
import { Info, Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SheetRow } from '@/components/ui/sheet-row'
import { exerciseName } from '@/programs/model'
import type { SessionExercise } from '@/stores/sessionStore'

/**
 * The actions sheet of one exercise on the edit page (design-system 15d):
 * Exercise info and Remove, behind a destructive confirm. Nothing is written
 * until the page saves. The only exercise left cannot be removed: the sheet
 * says why instead of opening the confirm.
 *
 * `entry` is a snapshot taken when the sheet opened, so the sheets can still
 * animate closed after the exercise is gone from the draft.
 */
export function EditExerciseSheet({
  open,
  onOpenChange,
  entry,
  isOnly,
  onInfo,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: SessionExercise
  isOnly: boolean
  onInfo: () => void
  onRemove: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const name = exerciseName(entry.exercise.exerciseRef)
  const logged = entry.sets.length

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
              <SheetDescription>Changes apply when you save.</SheetDescription>
            </div>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SheetRow
              icon={Info}
              label="Exercise info"
              onClick={() => {
                onOpenChange(false)
                onInfo()
              }}
            />
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
                A workout needs at least one exercise.
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
            ? `Its ${logged} logged ${logged === 1 ? 'set is' : 'sets are'} removed from this workout when you save.`
            : "It's removed from this workout when you save."
        }
        confirmLabel="Remove exercise"
        cancelLabel="Keep exercise"
        tone="destructive"
        onConfirm={() => {
          setConfirmOpen(false)
          onRemove()
        }}
      />
    </>
  )
}
