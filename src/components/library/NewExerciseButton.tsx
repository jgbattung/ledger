import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

/**
 * Header `+` that opens the custom exercise form (design-system 13h): a 44px
 * target with a 20px glyph, right-aligned to the 16px gutter. In the pickers it
 * fills the trailing spacer slot of the header row.
 */
export function NewExerciseButton({ to }: { to: string }) {
  return (
    <Link
      to={to}
      aria-label="New exercise"
      className="flex size-touch-min shrink-0 items-center justify-end rounded-md text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Plus className="size-5" aria-hidden="true" />
    </Link>
  )
}
