import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  dayAfter,
  exerciseName,
  isRestDay,
  passState,
  programTreeToDraft,
  type DayPassState,
} from '@/programs/model'
import type { ProgramTree } from '@/db/repos'

const SEGMENT_FILL: Record<DayPassState, string> = {
  done: 'bg-foreground/35',
  next: 'bg-foreground',
  upcoming: 'bg-foreground/15',
}

// Rest days are never filled: a dashed outline in the state's colour.
const SEGMENT_DASH: Record<DayPassState, string> = {
  done: 'border-foreground/35',
  next: 'border-foreground',
  upcoming: 'border-muted-foreground/60',
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Dashboard card for the active program's up-next day: the day name as the
 * hero, a segmented pass bar (design-system 9c) and either a one-line exercise
 * summary or, on a rest day, a full-row checkbox. A workout day ends in a
 * one-tap, ink-filled Start workout (the FAB owns this screen's only accent).
 *
 * While a workout is in progress (`ongoing`) the card has no Start button: the
 * floating bar is the way back in. If the running workout belongs to a day of
 * this program, that day becomes the hero under an "Ongoing" eyebrow.
 */
export function UpNextCard({
  tree,
  onCompleteRestDay,
  onStart,
  saving,
  starting,
  ongoing,
  ongoingDayId,
}: {
  tree: ProgramTree
  onCompleteRestDay: (dayId: string) => void
  onStart: (dayId: string) => void
  saving?: boolean
  starting?: boolean
  ongoing?: boolean
  ongoingDayId?: string | null
}) {
  const { name, days } = programTreeToDraft(tree)
  const completed = tree.program.completedDayIds ?? []
  const pass = passState(days, completed)
  const { doneCount } = pass
  const ongoingIndex = ongoing && ongoingDayId ? days.findIndex((d) => d.id === ongoingDayId) : -1
  const showingOngoing = ongoingIndex !== -1
  const nextIndex = showingOngoing ? ongoingIndex : pass.nextIndex
  // The hero day is always the one drawn as `next` in the pass bar.
  const states = showingOngoing
    ? pass.states.map((state, i) => (i === ongoingIndex ? 'next' : state === 'next' ? 'upcoming' : state))
    : pass.states
  const day = days[nextIndex]
  const rest = isRestDay(day)
  const afterName = days[dayAfter(days.map((d) => d.id), completed, nextIndex)].name
  const workingSets = day.exercises.reduce((sum, exercise) => sum + (exercise.workingSets ?? 0), 0)
  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }

  return (
    <section
      aria-label={showingOngoing ? 'Ongoing' : 'Up next'}
      className="mt-6 overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="px-3.5 pt-3.5">
        <p className="flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
          <span>{showingOngoing ? 'Ongoing' : 'Up next'}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{name}</span>
        </p>
        <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{day.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {rest
            ? `Then ${afterName}`
            : `${plural(day.exercises.length, 'exercise')} · ${plural(workingSets, 'working set')}`}
        </p>
      </div>

      <div
        role="img"
        aria-label={`Day ${nextIndex + 1} of ${days.length}: ${doneCount} done`}
        className="px-3.5 pt-3.5 pb-3.5"
      >
        <div className="grid gap-1" style={columns} aria-hidden="true">
          {days.map((d, i) => (
            <span
              key={d.id}
              data-state={states[i]}
              data-rest={isRestDay(d) ? 'true' : undefined}
              className={cn(
                'h-1.5 rounded-full',
                isRestDay(d)
                  ? cn('border border-dashed bg-transparent', SEGMENT_DASH[states[i]])
                  : SEGMENT_FILL[states[i]],
              )}
            />
          ))}
        </div>
        <div className="mt-1.5 grid gap-1" style={columns} aria-hidden="true">
          {days.map((d, i) => (
            <span
              key={d.id}
              data-state={states[i]}
              className={cn(
                'truncate text-[11px] text-muted-foreground',
                states[i] === 'next' && 'font-semibold text-foreground',
              )}
            >
              {d.name}
            </span>
          ))}
        </div>
      </div>

      {rest ? (
        <div className="border-t border-border px-3.5">
          <Checkbox
            size="block"
            checked={false}
            label="Mark rest day done"
            disabled={saving}
            description={`Moves you on to ${afterName}`}
            onCheckedChange={() => onCompleteRestDay(day.id)}
          />
        </div>
      ) : (
        <>
          {/* Padding lives on the wrapper: padding inside the clamp box would show a partial third line. */}
          <div className={cn('px-3.5', ongoing ? 'pb-3.5' : 'pb-3')}>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {day.exercises.map((exercise) => exerciseName(exercise.exerciseRef)).join(', ')}
            </p>
          </div>
          {ongoing ? null : (
            <div className="px-3.5 pb-3.5">
              <button
                type="button"
                disabled={starting}
                onClick={() => onStart(day.id)}
                className="flex h-touch-primary w-full items-center justify-center rounded-lg bg-foreground text-base font-medium text-background outline-none transition-colors hover:bg-foreground/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
              >
                Start workout
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
