import { NotebookText } from 'lucide-react'

/** Inline auto-growing day notes field, styled as the muted box. */
export function DayNotes({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="mt-3.5 flex min-h-touch-min items-start gap-2 rounded-lg bg-muted px-3 py-[11px] focus-within:ring-[3px] focus-within:ring-ring/50">
      <NotebookText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <textarea
        aria-label="Day notes"
        placeholder="Add day notes"
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-5 text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground"
      />
    </label>
  )
}
