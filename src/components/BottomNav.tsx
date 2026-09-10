import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, TrendingUp, Menu, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bottom bar: 4 destinations + 1 center action (`.gsd/user-flows.md` §1).
 *
 * Active treatment is ink, not brand: the active tab is `text-foreground` with a
 * filled glyph, inactive is `text-muted-foreground` outline. `text-primary` is
 * reserved for the FAB so exactly one accent appears per screen.
 *
 * lucide is a stroke-only set, so `fillOnActive` is decided per glyph - see the
 * note on each item. Glyphs that cannot carry a fill fall back to ink + weight.
 */
const NAV_ITEMS = [
  // Four closed rects: the fill reads as the canonical filled dashboard glyph.
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, fillOnActive: true },
  // Two closed plate paths joined by an open bar: the plates fill, the bar stays a stroke.
  { to: '/workout', label: 'Workout', icon: Dumbbell, end: false, fillOnActive: true },
  // Open polyline + open arrow head: a fill would close them into blobs. Ink + weight only.
  { to: '/levels', label: 'Levels', icon: TrendingUp, end: false, fillOnActive: false },
  // Three zero-area lines: a fill is a no-op. Ink + weight only.
  { to: '/more', label: 'More', icon: Menu, end: false, fillOnActive: false },
] as const

type NavItem = (typeof NAV_ITEMS)[number]

function NavTab({ to, label, icon: Icon, end, fillOnActive }: NavItem) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'flex min-h-touch-primary flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn('size-5', isActive && fillOnActive && 'fill-current/15')}
              strokeWidth={isActive ? 2.25 : 2}
              aria-hidden="true"
            />
            {label}
          </>
        )}
      </NavLink>
    </li>
  )
}

export function BottomNav({ onQuickActions }: { onQuickActions: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavTab key={item.to} {...item} />
        ))}

        {/*
          An action, not a destination: a real button, never a NavLink, so it
          stays out of `aria-current` and out of the "exactly one active tab"
          contract.
        */}
        <li className="relative flex-1">
          <button
            type="button"
            onClick={onQuickActions}
            aria-label="Quick actions"
            className={cn(
              'absolute bottom-fab-raise left-1/2 -translate-x-1/2',
              'flex size-touch-primary items-center justify-center rounded-full',
              'border-[3px] border-background bg-primary text-primary-foreground',
              'outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
          >
            <Plus className="size-6" aria-hidden="true" />
          </button>
        </li>

        {NAV_ITEMS.slice(2).map((item) => (
          <NavTab key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  )
}
