import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { programs, type ProgramTree } from '@/db/repos'
import { UpNextCard } from '@/components/programs/UpNextCard'
import { buttonVariants } from '@/components/ui/button'
import { passState } from '@/programs/model'
import { cn } from '@/lib/utils'

function NoActiveProgram() {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-3.5">
      <p className="text-xs font-medium text-muted-foreground">No active program</p>
      <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
        Activate a program to see your next workout here.
      </p>
      <Link
        to="/workout"
        className={cn(buttonVariants({ variant: 'secondary' }), 'h-12 w-full text-base')}
      >
        Go to Workout
      </Link>
    </div>
  )
}

export function DashboardPage() {
  const [trees, setTrees] = useState<ProgramTree[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void programs.listTrees().then((loaded) => {
      if (!cancelled) setTrees(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    setTrees(await programs.listTrees())
  }, [])

  const active = trees?.find((tree) => tree.program.isActive && !tree.program.isArchived)
  const nextIndex = active
    ? passState(
        active.days.map(({ day }) => day),
        active.program.completedDayIds,
      ).nextIndex
    : -1

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {trees === null ? (
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      ) : !active || nextIndex === -1 ? (
        <NoActiveProgram />
      ) : (
        <UpNextCard
          tree={active}
          onCompleteRestDay={(dayId) =>
            void programs.completeDay(active.program.id, dayId).then(reload)
          }
        />
      )}
    </div>
  )
}
