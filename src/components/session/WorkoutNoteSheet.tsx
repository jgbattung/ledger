import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FIELD_CLASS } from '@/components/ui/text-field-sheet'
import { useSessionStore } from '@/stores/sessionStore'

/** Edits the workout note (LOG-9). Typing saves through the store's 400ms debounce. */
export function WorkoutNoteSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const note = useSessionStore((state) => state.workout?.notes ?? '')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Workout note</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <label htmlFor="workout-note" className="sr-only">
            Workout note
          </label>
          <textarea
            id="workout-note"
            value={note}
            rows={4}
            placeholder="How did it go?"
            onChange={(event) => useSessionStore.getState().setWorkoutNote(event.target.value)}
            className={`${FIELD_CLASS} resize-none py-2.5`}
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-full items-center justify-center rounded-md bg-secondary text-base font-medium text-secondary-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
