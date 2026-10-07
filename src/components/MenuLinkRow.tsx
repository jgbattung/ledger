import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** An enabled menu row: label plus chevron, 56px target. Shared by the More menu and the FAB sheet. */
export function MenuLinkRow({
  to,
  label,
  onClick,
}: {
  to: string
  label: string
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className="flex min-h-touch-primary items-center justify-between gap-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="text-base">{label}</span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </NavLink>
  )
}
