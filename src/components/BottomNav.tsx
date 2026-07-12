import { NavLink } from 'react-router-dom'
import { CalendarCheck, Dumbbell, ClipboardList, TrendingUp, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/library', label: 'Library', icon: Dumbbell, end: false },
  { to: '/programs', label: 'Programs', icon: ClipboardList, end: false },
  { to: '/progress', label: 'Progress', icon: TrendingUp, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
] as const

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-touch-primary flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
