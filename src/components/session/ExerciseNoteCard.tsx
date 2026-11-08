import { useId } from 'react'
import { Pin } from 'lucide-react'
import { FIELD_CLASS } from '@/components/ui/text-field-sheet'
import { cn } from '@/lib/utils'

/**
 * Notes for one exercise (LOG-9): the program's note read-only above an
 * editable session note. Saving is debounced in the session store.
 */
export function ExerciseNoteCard({
  programNote,
  value,
  onChange,
}: {
  programNote?: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="mx-4 mt-4 rounded-[10px] border border-border bg-card px-3.5 py-3">
      {programNote ? (
        <p className="mb-2 flex gap-1.5 border-b border-border pb-2 text-[13px] text-muted-foreground">
          <Pin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Program note: {programNote}</span>
        </p>
      ) : null}
      <label htmlFor={id} className="text-sm font-semibold">
        Exercise note
      </label>
      <textarea
        id={id}
        value={value}
        rows={2}
        placeholder="Add a note for today…"
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CLASS, 'mt-2 block resize-none py-2.5')}
      />
    </div>
  )
}
