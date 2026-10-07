import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countWorkouts, exerciseName, isRestDay, programTreeToDraft } from '@/programs/model'
import type { ProgramTree } from '@/db/repos'

/**
 * One program on the Workout tab. The header is a link to the editor; the
 * caret is a separate 44px button that expands the day rows. Day rows are plain
 * content - they become tappable with the Day page (LG-022).
 */
export function ProgramCard({
  tree,
  defaultExpanded = false,
}: {
  tree: ProgramTree
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const rowsId = useId()
  const { id, name, days } = programTreeToDraft(tree)
  const workouts = countWorkouts(days)
  const Caret = expanded ? ChevronUp : ChevronDown

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-16 items-center gap-2 py-3 pr-1 pl-3.5">
        <Link
          to={`/programs/${id}`}
          className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="truncate text-[17px] font-semibold">{name}</p>
          <p className="mt-px text-sm text-muted-foreground tabular-nums">
            {workouts} {workouts === 1 ? 'workout' : 'workouts'}
          </p>
        </Link>
        <button
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
          aria-expanded={expanded}
          aria-controls={rowsId}
          onClick={() => setExpanded((value) => !value)}
          className="flex size-touch-min shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Caret className="size-5" aria-hidden="true" />
        </button>
      </div>
      <ul id={rowsId} hidden={!expanded}>
        {days.map((day) => {
          const rest = isRestDay(day)
          return (
            <li key={day.id} className="min-h-14 border-t border-border px-3.5 pt-2.5 pb-3">
              <p
                className={cn(
                  'text-[15px]',
                  rest ? 'text-muted-foreground' : 'font-medium',
                )}
              >
                {day.name}
              </p>
              {rest ? null : (
                <p className="line-clamp-2 text-[13px] text-muted-foreground">
                  {day.exercises.map((exercise) => exerciseName(exercise.exerciseRef)).join(', ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
