import { useRef, useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { RIR_FILL, ROW_GRID } from '@/components/session/styles'
import { cn } from '@/lib/utils'
import { formatPrevious, formatSide, formatSides, rirLabel } from '@/workouts/model'
import type { PadEntry, PadField, Side } from '@/workouts/model'
import type { Set as SetRecord } from '@/db/types'

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
 * An L/R set (design-system 10n) renders two lines inside the same row, so
 * swipe, dim and check behave identically. `pad` is the live pad buffer when
 * this row is the one being edited.
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
  onOpenPad: (field: PadField, side?: Side) => void
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

  const unilateral = set.unilateral
  const repsActive = pad?.field === 'reps'
  const hasReps = unilateral ? Math.max(unilateral.leftReps, unilateral.rightReps) > 0 : set.reps > 0

  const prev = previous && !unilateral ? formatPrevious(previous) : null
  const prevSides = previous
    ? (formatSides(previous) ?? [
        { side: 'L' as const, ...formatSide(previous.weight, previous.reps, previous.partialReps) },
        { side: 'R' as const, ...formatSide(previous.weight, previous.reps, previous.partialReps) },
      ])
    : null

  /** The kg and reps cells of one line; `side` is set only on an L/R set. */
  const renderCells = (
    side: Side | undefined,
    value: { weight: number; reps: number; partial?: number },
    withRir: boolean,
  ) => {
    const lineActive = pad !== null && pad.side === side
    const weightActive = lineActive && pad.field === 'weight'
    const lineRepsActive = lineActive && pad.field === 'reps'
    const name = side ? `${side === 'L' ? 'left' : 'right'} ` : ''
    // While typing, show the buffer ("62." must survive); otherwise the stored value.
    const weightText =
      weightActive && !pad.fresh ? pad.weight : value.weight === 0 && !checked ? '' : `${value.weight}`
    const repsText =
      lineRepsActive && pad.mode === 'F' && !pad.fresh
        ? pad.reps
        : value.reps === 0 && !checked
          ? ''
          : `${value.reps}`
    const partialText = lineRepsActive ? pad.partial : value.partial ? `${value.partial}` : ''
    const partialPending = lineRepsActive && pad.mode === 'P' && pad.partial === ''
    const showRir = withRir && (hasReps || checked || repsActive)
    return (
      <>
        <div role="cell" className={cn(dim && 'opacity-50')}>
          <button
            type="button"
            aria-label={`Set ${number} ${name}weight in kilograms`}
            aria-current={weightActive ? 'true' : undefined}
            onClick={() => onOpenPad('weight', side)}
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
            aria-label={`Set ${number} ${name}reps${showRir ? `, RIR ${rirLabel(set.rir, set.rirIsPlus)}` : ''}`}
            aria-current={lineRepsActive ? 'true' : undefined}
            onClick={() => onOpenPad('reps', side)}
            className={cn(CELL, lineRepsActive && 'bg-background ring-2 ring-ring')}
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
                  'absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-rir-ink ring-2 ring-background',
                  RIR_FILL[set.rirIsPlus ? 6 : Math.min(6, Math.max(0, set.rir))],
                )}
              >
                {rirLabel(set.rir, set.rirIsPlus)}
              </span>
            ) : null}
          </button>
        </div>
      </>
    )
  }

  /** One side's Previous cell: the side letter leads its value; no RIR (design-system 10n). */
  const renderSidePrevious = (side: Side) => {
    const entry = prevSides?.find((item) => item.side === side)
    return (
      <div role="cell" className={cn('flex min-w-0 items-center gap-1.5', dim && 'opacity-50')}>
        <span
          aria-hidden="true"
          className="w-[18px] shrink-0 text-center text-xs font-semibold text-muted-foreground"
        >
          {side}
        </span>
        {entry ? (
          <p className="min-w-0 truncate text-sm leading-tight tabular-nums">
            {entry.text}
            {entry.partial ? (
              <>
                <PartialDivider />
                {entry.partial}
              </>
            ) : null}
          </p>
        ) : (
          <span className="text-sm text-muted-foreground">–</span>
        )}
      </div>
    )
  }

  const numberCell = (
    <div
      role="cell"
      className={cn(
        'flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold tabular-nums',
        dim && 'opacity-50',
      )}
    >
      {number}
    </div>
  )

  const checkCell = (
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
  )

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
        {unilateral ? (
          <div className={cn(ROW_GRID, 'gap-y-1.5 py-1.5')}>
            <div className="col-start-1 row-start-1">{numberCell}</div>
            <div className="col-start-2 row-start-1 min-w-0">{renderSidePrevious('L')}</div>
            {renderCells(
              'L',
              {
                weight: unilateral.leftWeight,
                reps: unilateral.leftReps,
                partial: unilateral.leftPartialReps,
              },
              true,
            )}
            <div className="col-start-5 row-span-2 row-start-1">{checkCell}</div>
            <div className="col-start-2 row-start-2 min-w-0">{renderSidePrevious('R')}</div>
            {renderCells(
              'R',
              {
                weight: unilateral.rightWeight,
                reps: unilateral.rightReps,
                partial: unilateral.rightPartialReps,
              },
              false,
            )}
          </div>
        ) : (
          <div className={cn(ROW_GRID, 'min-h-14')}>
            {numberCell}

            <div
              role="cell"
              className={cn('min-w-0 text-sm leading-tight tabular-nums', dim && 'opacity-50')}
            >
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

            {renderCells(undefined, { weight: set.weight, reps: set.reps, partial: set.partialReps }, true)}

            {checkCell}
          </div>
        )}
      </div>
    </div>
  )
}
