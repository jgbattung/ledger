import type { ComponentType, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { SoonPill } from '@/components/SoonRow'
import { cn } from '@/lib/utils'

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>

/** One 48px drawer row: 14px text, 16px muted leading icon (design-system 8b). */
export function SheetRow({
  icon: Icon,
  label,
  value,
  onClick,
  soon,
  disabled,
  danger,
}: {
  icon: Icon
  label: string
  value?: ReactNode
  onClick?: () => void
  soon?: boolean
  /** Temporarily unavailable (an action is in flight): no Soon pill or muted label. */
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={soon || disabled}
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 border-t border-border px-4 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <Icon
        className={cn('size-4 shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 flex-1',
          danger && 'text-destructive',
          (soon || disabled) && 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {value ? (
        <span className="max-w-36 truncate text-muted-foreground">{value}</span>
      ) : null}
      {onClick && !danger && value !== undefined ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      {soon ? <SoonPill /> : null}
    </button>
  )
}
