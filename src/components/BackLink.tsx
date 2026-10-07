import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Top-of-screen back affordance. 44px target; the chevron's visible left edge
 * sits exactly on the 16px screen gutter. The lucide chevron has an 8px inset
 * inside its 24px box, so the glyph is pulled left by that amount while the
 * button box (and its 44px target) extends right.
 *
 * Pass `to` for a fixed destination, or `onBack` for history-aware back.
 */
const CLASS_NAME =
  'flex size-touch-min items-center justify-start rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50'

type BackLinkProps = { label: string; className?: string } & (
  | { to: string; onBack?: never }
  | { onBack: () => void; to?: never }
)

export function BackLink({ to, onBack, label, className }: BackLinkProps) {
  const icon = <ChevronLeft className="-ml-2 size-6" aria-hidden="true" />
  if (onBack) {
    return (
      <button type="button" aria-label={label} onClick={onBack} className={cn(CLASS_NAME, className)}>
        {icon}
      </button>
    )
  }
  return (
    <Link to={to} aria-label={label} className={cn(CLASS_NAME, className)}>
      {icon}
    </Link>
  )
}
