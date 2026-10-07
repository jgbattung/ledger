import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ListChecks, Plus } from 'lucide-react'
import { programs, type ProgramTree } from '@/db/repos'
import { ProgramCard } from '@/components/programs/ProgramCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-6 mb-2.5 text-xl font-semibold">{children}</h2>
}

function SkeletonCard() {
  return <div className="h-16 animate-pulse rounded-lg bg-muted" />
}

function EmptyState() {
  return (
    <div className="mt-32 px-3 text-center">
      <div className="mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ListChecks className="size-6" aria-hidden="true" />
      </div>
      <p className="text-lg font-semibold">No programs yet</p>
      <p className="mt-1.5 mb-5 text-sm text-muted-foreground">
        A program is a list of days that repeats. Build one, then every workout starts from its next
        day.
      </p>
      <Link to="/programs/new" className={cn(buttonVariants(), 'h-12 w-full text-base')}>
        Create your first program
      </Link>
    </div>
  )
}

export function WorkoutPage() {
  const [trees, setTrees] = useState<ProgramTree[] | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void programs.listTrees().then((loaded) => {
      if (!cancelled) setTrees(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const live = trees?.filter((tree) => !tree.program.isArchived) ?? []
  const active = live.find((tree) => tree.program.isActive)
  const library = live
    .filter((tree) => !tree.program.isActive)
    .sort((a, b) => b.program.updatedAt - a.program.updatedAt)
  const archived = (trees ?? [])
    .filter((tree) => tree.program.isArchived)
    .sort((a, b) => b.program.updatedAt - a.program.updatedAt)

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workout</h1>
        <Link
          to="/programs/new"
          aria-label="New program"
          className="flex size-touch-min items-center justify-end rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="-mr-[5px] size-6" aria-hidden="true" />
        </Link>
      </div>

      {trees === null ? (
        <div className="mt-6 space-y-2.5" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {live.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <SectionTitle>Active Program</SectionTitle>
              {active ? (
                <ProgramCard tree={active} defaultExpanded />
              ) : (
                <p className="text-sm text-muted-foreground">Open a program and tap Activate.</p>
              )}

              {library.length > 0 ? (
                <>
                  <SectionTitle>Workout Library</SectionTitle>
                  <div className="space-y-2.5">
                    {library.map((tree) => (
                      <ProgramCard key={tree.program.id} tree={tree} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}

          {archived.length > 0 ? (
            <section className="mt-2.5">
              <button
                type="button"
                aria-expanded={archivedOpen}
                aria-controls="archived-programs"
                onClick={() => setArchivedOpen((value) => !value)}
                className="flex min-h-touch-min w-full items-center justify-between rounded-md text-sm font-medium text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span>Archived · {archived.length}</span>
                {archivedOpen ? (
                  <ChevronUp className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4" aria-hidden="true" />
                )}
              </button>
              <div id="archived-programs" hidden={!archivedOpen} className="mt-1 space-y-2.5">
                {archived.map((tree) => (
                  <ProgramCard key={tree.program.id} tree={tree} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
