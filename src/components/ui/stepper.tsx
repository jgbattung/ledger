import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Formats a total-seconds value as `m:ss` (180 -> "3:00"). */
export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type StepperProps = {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  decrementLabel: string
  incrementLabel: string
  disabled?: boolean
  className?: string
}

const buttonBaseClass = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-md border bg-background',
  'shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground',
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:opacity-50',
)

function Stepper({
  value,
  onValueChange,
  min,
  max,
  step,
  formatValue,
  decrementLabel,
  incrementLabel,
  disabled = false,
  className,
}: StepperProps) {
  const atMin = value <= min
  const atMax = value >= max

  const decrement = () => {
    if (disabled || atMin) return
    onValueChange(Math.max(min, value - step))
  }

  const increment = () => {
    if (disabled || atMax) return
    onValueChange(Math.min(max, value + step))
  }

  const display = formatValue ? formatValue(value) : String(value)

  return (
    <div data-slot="stepper" className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        className={buttonBaseClass}
        onClick={decrement}
        disabled={disabled || atMin}
        aria-disabled={disabled || atMin}
        aria-label={decrementLabel}
      >
        <Minus className="size-4" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[3.5ch] text-center text-lg font-medium tabular-nums"
      >
        {display}
      </span>
      <button
        type="button"
        className={buttonBaseClass}
        onClick={increment}
        disabled={disabled || atMax}
        aria-disabled={disabled || atMax}
        aria-label={incrementLabel}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export { Stepper }
