import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/**
 * Top-of-screen back affordance for a screen that sits one level below a menu.
 * 44px target, optically pulled left so the glyph lines up with the screen
 * gutter rather than the button's box.
 */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="-ml-3 flex size-touch-min items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronLeft className="size-6" aria-hidden="true" />
    </Link>
  )
}
