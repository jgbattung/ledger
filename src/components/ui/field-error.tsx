import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Validation message in ink with a small alert icon (design-system 13b).
 * `destructive` red is reserved for destructive actions, never validation.
 */
export function FieldError({
  id,
  message,
  alert,
  className,
}: {
  id?: string
  message?: string | null
  /** Announce it (a message that appears on submit). */
  alert?: boolean
  className?: string
}) {
  if (!message) return null
  return (
    <p
      id={id}
      role={alert ? 'alert' : undefined}
      className={cn('mt-1.5 flex items-start gap-1.5 text-sm text-foreground', className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
