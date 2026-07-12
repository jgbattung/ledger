import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/BottomNav'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto px-4 pb-[calc(var(--touch-primary)+env(safe-area-inset-bottom)+1rem)] pt-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
