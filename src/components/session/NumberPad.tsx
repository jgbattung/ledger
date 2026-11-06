import { Delete } from 'lucide-react'
import type { ReactNode } from 'react'
import { RIR_FILL } from '@/components/session/SetRow'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/sessionStore'
import type { PadKey } from '@/workouts/model'

const KEY =
  'flex h-11 items-center justify-center rounded-lg border border-border bg-background text-[22px] font-medium tabular-nums outline-none transition-colors active:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50'
// Dimmed keys follow the disabled chip treatment (8c): dashed, never lowered opacity.
const DIMMED =
  'border-dashed bg-transparent text-muted-foreground disabled:pointer-events-none'

function Key({
  keyName,
  label,
  className,
  disabled,
  children,
}: {
  keyName: PadKey
  label: string
  className?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => useSessionStore.getState().padKey(keyName)}
      className={cn(KEY, disabled && DIMMED, className)}
    >
      {children}
    </button>
  )
}

/** Keyboard with a down arrow: hides the pad (lucide has no matching glyph). */
function KeyboardDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M7 7h.01M11 7h.01M15 7h.01M7 11h10M9 18l3 3 3-3" />
    </svg>
  )
}

const DIGITS: PadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
]

/** RIR values on the pad: 0-5 and "6+" (a distinct value that round-trips). */
const RIR_VALUES = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * The custom number pad (design-system 10h): docked at the bottom with no
 * scrim and at most 40svh, so the system keyboard never opens. Layout
 * `1 2 3 F|P / 4 5 6 Next / 7 8 9 Next / . 0 delete hide`.
 */
export function NumberPad() {
  const pad = useSessionStore((state) => state.pad)
  const activeSet = useSessionStore((state) =>
    state.pad
      ? state.exercises.flatMap((entry) => entry.sets).find((row) => row.id === state.pad?.setId)
      : undefined,
  )
  if (!pad || !activeSet) return null

  const { entry } = pad
  const weight = entry.field === 'weight'
  const selectedRir = activeSet.rirIsPlus ? 6 : activeSet.rir

  return (
    <div
      role="group"
      aria-label="Number pad"
      className="max-h-[40svh] shrink-0 overflow-y-auto border-t border-border bg-card px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
    >
      {!weight ? (
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">RIR</span>
          {RIR_VALUES.map((value) => {
            const selected = selectedRir === value
            return (
              <button
                key={value}
                type="button"
                aria-label={`RIR ${value === 6 ? '6 or more' : value}`}
                aria-pressed={selected}
                onClick={() => useSessionStore.getState().setRir(activeSet.id, value, value === 6)}
                className="flex h-10 min-w-10 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-xs font-semibold text-rir-ink',
                    RIR_FILL[value],
                    selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'opacity-55',
                  )}
                >
                  {value === 6 ? '6+' : value}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_1.1fr] gap-1.5">
        {DIGITS[0].map((digit) => (
          <Key key={digit} keyName={digit} label={digit}>
            {digit}
          </Key>
        ))}
        <button
          type="button"
          aria-label="Partial reps"
          aria-pressed={entry.mode === 'P'}
          disabled={weight}
          onClick={() => useSessionStore.getState().padKey('fp')}
          className={cn(
            KEY,
            'overflow-hidden bg-secondary p-0 text-base font-semibold',
            weight && cn(DIMMED, 'bg-transparent'),
          )}
        >
          <span
            className={cn(
              'flex h-full flex-1 items-center justify-center',
              !weight && entry.mode === 'F' ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            F
          </span>
          <span
            className={cn(
              'flex h-full flex-1 items-center justify-center border-l border-border',
              !weight && entry.mode === 'P' ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            P
          </span>
        </button>

        {DIGITS[1].map((digit) => (
          <Key key={digit} keyName={digit} label={digit}>
            {digit}
          </Key>
        ))}
        <button
          type="button"
          onClick={() => useSessionStore.getState().padNext()}
          className="row-span-2 flex items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Next
        </button>

        {DIGITS[2].map((digit) => (
          <Key key={digit} keyName={digit} label={digit}>
            {digit}
          </Key>
        ))}

        <Key keyName="." label="Decimal point" disabled={!weight}>
          .
        </Key>
        <Key keyName="0" label="0">
          0
        </Key>
        <Key keyName="back" label="Delete" className="bg-secondary">
          <Delete className="size-5" aria-hidden="true" />
        </Key>
        <button
          type="button"
          aria-label="Hide keypad"
          onClick={() => useSessionStore.getState().closePad()}
          className={cn(KEY, 'bg-secondary')}
        >
          <KeyboardDownIcon />
        </button>
      </div>
    </div>
  )
}
