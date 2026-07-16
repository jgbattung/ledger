import { Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatFilterValue } from '@/exercises/filtering'
import { cn } from '@/lib/utils'
import { FACET_LABELS } from './types'
import type { Facet } from './types'

type FilterSheetProps = {
  facet: Facet | null
  options: string[]
  selected: string | null
  onSelect: (value: string | null) => void
  onOpenChange: (open: boolean) => void
}

/** One sheet instance, parameterized by which facet is currently open
 * (LIB-3). Single-column option rows, an "All" row to clear the facet, the
 * selected option marked with a check. Values are displayed Title-cased -
 * `onSelect` always receives the raw dataset value. */
export function FilterSheet({ facet, options, selected, onSelect, onOpenChange }: FilterSheetProps) {
  return (
    <Sheet open={facet !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{facet ? FACET_LABELS[facet] : ''}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pb-2">
          <OptionRow label="All" selected={selected === null} onClick={() => onSelect(null)} />
          {options.map((option) => (
            <OptionRow
              key={option}
              label={formatFilterValue(option)}
              selected={option === selected}
              onClick={() => onSelect(option)}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OptionRow({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-touch-min w-full items-center justify-between gap-2 px-4 text-base outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected ? 'text-primary' : 'text-foreground',
      )}
    >
      {label}
      {selected ? <Check className="size-4" aria-hidden="true" /> : null}
    </button>
  )
}
