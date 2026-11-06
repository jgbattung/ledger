import { useRef, useState } from 'react'
import { Check, Minus } from 'lucide-react'
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

/** How far a swiped row travels to reveal the remove button (design-system 10g). */
const SWIPE_TRAVEL = 52
/** Horizontal movement before a touch counts as a swipe rather than a tap or scroll. */
const SWIPE_INTENT = 8

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
  swipeOpen,
  onSwipeOpenChange,
  onRemove,
}: {
  set: SetRecord
  number: number
  previous?: SetRecord
  /** Target rep range shown in an unfilled reps cell ("8–10", "8" or ""). */
  placeholder: string
  pad: PadEntry | null
  onOpenPad: (field: PadField) => void
  onToggle: () => void
  /** The row is swiped open, showing its remove button. */
  swipeOpen: boolean
  onSwipeOpenChange: (open: boolean) => void
  onRemove: () => void
}) {
  const [drag, setDrag] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
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

  const offset = drag ?? (swipeOpen ? -SWIPE_TRAVEL : 0)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    gesture.current = { x: event.clientX, y: event.clientY, moved: false }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.moved) {
      if (Math.abs(dx) < SWIPE_INTENT || Math.abs(dx) < Math.abs(dy) * 1.2) return
      start.moved = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    const base = swipeOpen ? -SWIPE_TRAVEL : 0
    setDrag(Math.min(0, Math.max(-SWIPE_TRAVEL, base + dx)))
  }
  const endGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    gesture.current = null
    if (!start?.moved) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    suppressClick.current = true
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
    const finalOffset = drag ?? offset
    setDrag(null)
    onSwipeOpenChange(finalOffset < -SWIPE_TRAVEL / 2)
  }

  return (
    <div
      role="row"
      aria-label={`Set ${number}`}
      tabIndex={0}
      data-swipe-row={swipeOpen ? 'open' : undefined}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          onRemove()
        }
      }}
      className="relative overflow-x-clip rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div role="cell" className="absolute inset-y-0 right-0 flex w-[52px] items-center justify-center">
        <button
          type="button"
          aria-label={`Remove set ${number}`}
          tabIndex={swipeOpen ? 0 : -1}
          aria-hidden={swipeOpen ? undefined : true}
          onClick={onRemove}
          className="flex size-touch-min items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
          >
            <Minus className="size-4" strokeWidth={3} />
          </span>
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.stopPropagation()
            event.preventDefault()
          }
        }}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        className={cn(
          'relative bg-background',
          drag === null && 'transition-transform duration-200 ease-out-app motion-reduce:transition-none',
        )}
      >
        <div className={cn(ROW_GRID, 'min-h-14')}>
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
      </div>
    </div>
  )
}
