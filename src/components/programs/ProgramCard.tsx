import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import {
  countWorkouts,
  exerciseName,
  isRestDay,
  passState,
  programTreeToDraft,
} from '@/programs/model'
import type { ProgramTree } from '@/db/repos'

export type ProgramProgress = {
  completedDayIds: string[]
  onCompleteDay: (dayId: string) => void
  onUncompleteDay: (dayId: string) => void
  /** A progress save and reload is running: checkboxes ignore taps. */
  saving?: boolean
}

/**
 * One program on the Workout tab. The header is a link to the editor; the
 * caret is a separate 44px button that expands the day rows. Day rows are not
 * tappable - they become so with the Day page (LG-022); the only controls in a
 * row are its checkbox. With `progress` (active program only) rows show the
 * current pass: ticks, an ink "Up next" rail and pill, and rest checkboxes.
 */
export function ProgramCard({
  tree,
  defaultExpanded = false,
  progress,
}: {
  tree: ProgramTree
  defaultExpanded?: boolean
  progress?: ProgramProgress
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [confirmDayId, setConfirmDayId] = useState<string | null>(null)
  const rowsId = useId()
  const { id, name, days } = programTreeToDraft(tree)
  const workouts = countWorkouts(days)
  const Caret = expanded ? ChevronUp : ChevronDown
  const pass = progress ? passState(days, progress.completedDayIds) : null
  const confirmDay = days.find((day) => day.id === confirmDayId)

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
            {pass ? ` · ${pass.doneCount} of ${days.length} done` : ''}
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
        {days.map((day, index) => {
          const rest = isRestDay(day)
          const state = pass?.states[index]
          const done = state === 'done'
          const next = state === 'next'
          const openable = !rest && !tree.program.isArchived
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-[15px]',
                    done || (rest && !next) ? 'text-muted-foreground' : 'font-medium',
                    next && 'font-semibold',
                  )}
                >
                  {day.name}
                  {next ? (
                    <span className="ml-2 inline-block rounded-full bg-foreground px-2 py-px align-[1px] text-xs font-medium text-background">
                      Up next
                    </span>
                  ) : null}
                </p>
                {rest ? null : (
                  <p className="line-clamp-2 text-[13px] text-muted-foreground">
                    {day.exercises
                      .map((exercise) => exerciseName(exercise.exerciseRef))
                      .join(', ')}
                  </p>
                )}
              </div>
              {openable ? (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </>
          )
          const spacing = cn(
            'flex min-w-0 flex-1 items-center gap-2 pt-2.5 pb-3 pr-3.5',
            progress ? 'pl-0.5' : 'pl-3.5',
          )
          return (
            <li
              key={day.id}
              className={cn(
                'relative flex min-h-14 border-t border-border',
                progress && 'pl-1',
                next && 'bg-foreground/[0.04]',
              )}
            >
              {next ? (
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-foreground" />
              ) : null}
              {progress ? (
                rest || done ? (
                  <Checkbox
                    size="row"
                    checked={done}
                    emphasis={next}
                    disabled={progress.saving}
                    label={`Mark ${day.name} ${done ? 'not done' : 'done'}`}
                    onCheckedChange={() => {
                      if (!done) progress.onCompleteDay(day.id)
                      else if (rest) progress.onUncompleteDay(day.id)
                      else setConfirmDayId(day.id)
                    }}
                  />
                ) : (
                  <span aria-hidden="true" className="size-touch-min shrink-0" />
                )
              ) : null}
              {openable ? (
                <Link
                  to={`/programs/${id}/days/${day.id}`}
                  className={cn(
                    spacing,
                    'outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className={spacing}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
      {progress && confirmDay ? (
        <ConfirmSheet
          open
          onOpenChange={(open) => {
            if (!open) setConfirmDayId(null)
          }}
          title={`Mark ${confirmDay.name} not done?`}
          description="It moves back into this pass. Logging its workout ticks it again."
          confirmLabel="Mark not done"
          cancelLabel="Keep it done"
          tone="neutral"
          onConfirm={() => {
            progress.onUncompleteDay(confirmDay.id)
            setConfirmDayId(null)
          }}
        />
      ) : null}
    </div>
  )
}
