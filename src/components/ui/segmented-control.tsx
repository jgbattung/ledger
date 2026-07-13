import * as React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedControlOption<T>[]
  'aria-label': string
  disabled?: boolean
  className?: string
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
  ...props
}: SegmentedControlProps<T>) {
  const select = (next: T) => {
    if (disabled) return
    onValueChange(next)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const currentIndex = options.findIndex((option) => option.value === value)
    if (currentIndex === -1) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    }

    if (nextIndex !== null) {
      event.preventDefault()
      const next = options[nextIndex]
      select(next.value)
      const segment = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[
        nextIndex
      ]
      segment?.focus()
    }
  }

  return (
    <div
      data-slot="segmented-control"
      role="radiogroup"
      aria-label={props['aria-label']}
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full items-center gap-0.5 rounded-md bg-muted p-0.5',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => select(option.value)}
            className={cn(
              'min-h-touch-min flex-1 rounded-sm px-2 text-sm font-medium transition-all duration-150 ease-out-app',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:pointer-events-none',
              checked
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
