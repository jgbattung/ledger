import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrevious, rirLabel } from '@/workouts/model'
import type { PadEntry, PadField } from '@/workouts/model'
import type { Set as SetRecord } from '@/db/types'

/** Full class names so Tailwind can see them (design-system 10c). */
export const RIR_FILL = [
  'bg-rir-0',
  'bg-rir-1',
  'bg-rir-2',
  'bg-rir-3',
  'bg-rir-4',
  'bg-rir-5',
  'bg-rir-6',
] as const

export const ROW_GRID = 'grid grid-cols-[32px_minmax(0,1fr)_64px_64px_44px] items-center gap-x-1.5'

/** The muted `|` between full and partial reps (design-system 10d). */
export function PartialDivider() {
  return (
    <span aria-hidden="true" className="px-[3px] font-normal text-muted-foreground">
      |
    </span>
  )
}

const CELL =
  'relative flex h-11 w-full items-center justify-center rounded-lg bg-muted text-lg font-medium tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * One set row (design-system 10a-10f): Set | Previous | kg | Reps | check.
 * `pad` is the live pad buffer when this row is the one being edited.
 */
export function SetRow({
  set,
  number,
  previous,
  placeholder,
  pad,
  onOpenPad,
  onToggle,
}: {
  set: SetRecord
  number: number
  previous?: SetRecord
  /** Target rep range shown in an unfilled reps cell ("8–10", "8" or ""). */
  placeholder: string
  pad: PadEntry | null
  onOpenPad: (field: PadField) => void
  onToggle: () => void
}) {
  const checked = set.completedAt != null
  const editing = pad !== null
  const dim = checked && !editing

  const weightActive = pad?.field === 'weight'
  const repsActive = pad?.field === 'reps'

  // While typing, show the buffer ("62." must survive); otherwise the stored value.
  const weightText =
    weightActive && !pad.fresh
      ? pad.weight
      : set.weight === 0 && !checked
        ? ''
        : `${set.weight}`
  const repsText =
    repsActive && pad.mode === 'F' && !pad.fresh
      ? pad.reps
      : set.reps === 0 && !checked
        ? ''
        : `${set.reps}`
  const partialText = repsActive ? pad.partial : set.partialReps ? `${set.partialReps}` : ''
  const partialPending = repsActive && pad.mode === 'P' && pad.partial === ''
  const showRir = set.reps > 0 || checked || repsActive

  const prev = previous ? formatPrevious(previous) : null

  return (
    <div role="row" aria-label={`Set ${number}`} className={cn(ROW_GRID, 'min-h-14 bg-background')}>
      <div
        role="cell"
        className={cn(
          'flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold tabular-nums',
          dim && 'opacity-50',
        )}
      >
        {number}
      </div>

      <div role="cell" className={cn('min-w-0 text-sm leading-tight tabular-nums', dim && 'opacity-50')}>
        {prev ? (
          <>
            <p className="truncate">
              {prev.text}
              {prev.partial ? (
                <>
                  <PartialDivider />
                  {prev.partial}
                </>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{prev.rir}</p>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </div>

      <div role="cell" className={cn(dim && 'opacity-50')}>
        <button
          type="button"
          aria-label={`Set ${number} weight in kilograms`}
          aria-current={weightActive ? 'true' : undefined}
          onClick={() => onOpenPad('weight')}
          className={cn(CELL, weightActive && 'bg-background ring-2 ring-ring')}
        >
          {weightText !== '' ? (
            weightText
          ) : (
            <span className="text-[15px] font-normal text-muted-foreground">–</span>
          )}
        </button>
      </div>

      <div role="cell" className={cn(dim && 'opacity-50')}>
        <button
          type="button"
          aria-label={`Set ${number} reps${showRir ? `, RIR ${rirLabel(set.rir, set.rirIsPlus)}` : ''}`}
          aria-current={repsActive ? 'true' : undefined}
          onClick={() => onOpenPad('reps')}
          className={cn(CELL, repsActive && 'bg-background ring-2 ring-ring')}
        >
          {repsText !== '' || partialText !== '' || partialPending ? (
            <>
              {repsText}
              {partialText !== '' || partialPending ? (
                <>
                  <PartialDivider />
                  {partialText !== '' ? (
                    partialText
                  ) : (
                    <span className="text-muted-foreground">_</span>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <span className="text-[15px] font-normal text-muted-foreground">{placeholder || '–'}</span>
          )}
          {showRir ? (
            <span
              aria-hidden="true"
              className={cn(
                'absolute -top-[7px] -right-[7px] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-rir-ink ring-2 ring-background',
                RIR_FILL[set.rirIsPlus ? 6 : Math.min(6, Math.max(0, set.rir))],
              )}
            >
              {rirLabel(set.rir, set.rirIsPlus)}
            </span>
          ) : null}
        </button>
      </div>

      <div role="cell" className="flex justify-end">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Mark set ${number} ${checked ? 'not done' : 'done'}`}
          onClick={onToggle}
          className="flex size-touch-min items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-[26px] items-center justify-center rounded-md border-2 border-foreground transition-colors duration-150 motion-reduce:transition-none',
              checked && 'bg-foreground text-background',
            )}
          >
            {checked ? <Check className="size-[15px]" strokeWidth={3} /> : null}
          </span>
        </button>
      </div>
    </div>
  )
}
