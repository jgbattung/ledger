import { useId } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type CheckboxProps = {
  checked: boolean
  onCheckedChange: () => void
  /** Accessible name. For `block` it doubles as the visible label. */
  label: string
  /** `row`: 24px box in a 44px hit area. `block`: 56px full-width row. */
  size: 'row' | 'block'
  /** Block only: secondary line under the label. */
  description?: string
  /** Heavier ink border on the unchecked box (the up-next rest day). */
  emphasis?: boolean
  className?: string
}

const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Box({
  checked,
  emphasis,
  large,
}: {
  checked: boolean
  emphasis?: boolean
  large?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors duration-150 motion-reduce:transition-none',
        large ? 'size-7 border-2' : 'size-6',
        checked
          ? 'border-transparent bg-muted text-muted-foreground'
          : emphasis || large
            ? 'border-foreground'
            : 'border-muted-foreground',
      )}
    >
      <Check
        className={cn(
          large ? 'size-4' : 'size-3.5',
          'transition-opacity duration-150 motion-reduce:transition-none',
          checked ? 'opacity-100' : 'opacity-0',
        )}
        strokeWidth={3}
      />
    </span>
  )
}

/**
 * Single button-based checkbox (`role="checkbox"`), ink only - never primary,
 * which the FAB owns. See design-system.md section 9.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  size,
  description,
  emphasis,
  className,
}: CheckboxProps) {
  const descriptionId = useId()

  if (size === 'row') {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onCheckedChange}
        className={cn(
          'flex size-touch-min shrink-0 items-center justify-center rounded-md',
          FOCUS,
          className,
        )}
      >
        <Box checked={checked} emphasis={emphasis} />
      </button>
    )
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={description ? descriptionId : undefined}
      onClick={onCheckedChange}
      className={cn(
        'flex min-h-touch-primary w-full items-center gap-3.5 rounded-md text-left',
        FOCUS,
        className,
      )}
    >
      <Box checked={checked} large />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{label}</span>
        {description ? (
          <span id={descriptionId} className="block text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  )
}
