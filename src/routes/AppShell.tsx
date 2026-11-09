import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'
import { QuickActionSheet } from '@/components/QuickActionSheet'
import { WorkoutBar } from '@/components/session/WorkoutBar'
import { setLastTab } from '@/lib/lastTab'
import { cn } from '@/lib/utils'
import { useInProgressWorkout } from '@/stores/useInProgressWorkout'

export function AppShell() {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const { workout } = useInProgressWorkout()
  const { pathname, search } = useLocation()

  useEffect(() => {
    setLastTab(pathname + search)
  }, [pathname, search])

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      {/*
        The bottom padding clears the bar (--touch-primary), the FAB's raise
        above it (--fab-raise), the gesture inset, and a resting gap - so the
        last row of a scrolled list can never sit under the FAB. While the
        in-progress bar shows (design-system 11) it adds the bar's minimum
        height (--touch-primary) and its 8px gap above the FAB.
      */}
      <main
        className={cn(
          'flex-1 overflow-y-auto px-4',
          workout
            ? 'pb-[calc(var(--touch-primary)*2+var(--fab-raise)+env(safe-area-inset-bottom)+1.5rem)]'
            : 'pb-[calc(var(--touch-primary)+var(--fab-raise)+env(safe-area-inset-bottom)+1rem)]',
        )}
      >
        <Outlet />
      </main>
      <WorkoutBar />
      <BottomNav onQuickActions={() => setQuickActionsOpen(true)} />
      <QuickActionSheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen} />
    </div>
  )
}

/**
 * Layout for full-screen takeovers that own the whole viewport - no bottom nav,
 * no space reserved for one. LG-010's Ongoing Workout mounts inside this and
 * changes no shell code.
 */
export function ChromelessShell() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
