import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isSameYear } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { LoggedSetLine } from '@/components/library/LoggedSetLine'
import { workouts } from '@/db/repos'
import type { ExerciseHistoryEntry } from '@/db/repos'
import type { ExerciseRef } from '@/db/types'
import { workoutPath } from '@/lib/paths'

function HistoryBlock({ entry }: { entry: ExerciseHistoryEntry }) {
  const { workout, sets } = entry
  const date = new Date(workout.startedAt)
  const pastYear = !isSameYear(date, new Date())
  const line = [format(date, 'EEE'), workout.name, workout.programName]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

  return (
    <li className="border-b border-border">
      <Link
        to={workoutPath(workout.id)}
        aria-label={`Open workout, ${workout.name}, ${format(date, 'EEE d MMM')}`}
        className="grid grid-cols-[44px_minmax(0,1fr)_16px] gap-2.5 px-4 py-3.5 outline-none hover:bg-foreground/[0.03] focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <div className="pt-px text-center">
          <p className="text-xl leading-tight font-semibold tabular-nums">{format(date, 'd')}</p>
          <p className="text-[11px] leading-snug font-medium tracking-wider text-muted-foreground uppercase">
            {format(date, 'MMM')}
          </p>
          {pastYear ? (
            <p className="text-[11px] leading-snug font-medium tracking-wider text-muted-foreground tabular-nums">
              {format(date, 'yyyy')}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          {/* The right side of this line is reserved for LG-051's session e1RM (design-system 12d). */}
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px] text-muted-foreground">
            <p className="min-w-0 truncate">{line}</p>
          </div>
          <ul>
            {sets.map((set) => (
              <LoggedSetLine key={set.id} set={set} />
            ))}
          </ul>
        </div>
        <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

/** Every logged set of one exercise, grouped by workout, newest first (LIB-9; design-system 12d). */
export function ExerciseHistory({ exerciseRef }: { exerciseRef: ExerciseRef }) {
  const [entries, setEntries] = useState<ExerciseHistoryEntry[] | null>(null)
  const { source, exerciseId } = exerciseRef

  useEffect(() => {
    let cancelled = false
    void workouts.historyForExercise({ source, exerciseId }).then((loaded) => {
      if (!cancelled) setEntries(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [source, exerciseId])

  if (entries === null) return null

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="text-lg font-semibold">No sets logged yet</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sets you log for this exercise will show up here.
        </p>
      </div>
    )
  }

  return (
    <ul>
      {entries.map((entry) => (
        <HistoryBlock key={entry.workout.id} entry={entry} />
      ))}
    </ul>
  )
}
