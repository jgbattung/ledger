import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ExerciseSearchFieldProps = {
  value: string
  onChange: (value: string) => void
}

/** Full-width live search field for the library list (LIB-2). */
export function ExerciseSearchField({ value, onChange }: ExerciseSearchFieldProps) {
  return (
    <div className="relative flex items-center">
      <Search
        className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label="Search exercises"
        placeholder="Search exercises"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'min-h-touch-min w-full rounded-md border border-transparent bg-muted pl-9 text-base text-foreground',
          value ? 'pr-11' : 'pr-3',
          'placeholder:text-muted-foreground outline-none',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className={cn(
            'absolute right-0 flex size-11 shrink-0 items-center justify-center rounded-md outline-none',
            'text-muted-foreground transition-colors hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
