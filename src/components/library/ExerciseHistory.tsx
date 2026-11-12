import { useEffect, useState } from 'react'
import { format, isSameYear } from 'date-fns'
import { PartialDivider } from '@/components/session/SetRow'
import { workouts } from '@/db/repos'
import type { ExerciseHistoryEntry } from '@/db/repos'
import type { ExerciseRef } from '@/db/types'
import { formatPrevious } from '@/workouts/model'

function HistoryBlock({ entry }: { entry: ExerciseHistoryEntry }) {
  const { workout, sets } = entry
  const date = new Date(workout.startedAt)
  const pastYear = !isSameYear(date, new Date())
  const line = [format(date, 'EEE'), workout.name, workout.programName]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 border-b border-border px-4 py-3.5">
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
          {sets.map((set) => {
            const logged = formatPrevious(set)
            return (
              <li
                key={set.id}
                className="flex items-baseline justify-between gap-2 py-0.5 text-base tabular-nums"
              >
                <span>
                  {logged.text}
                  {logged.partial ? (
                    <>
                      <PartialDivider />
                      {logged.partial}
                    </>
                  ) : null}
                </span>
                <span className="text-[13px] text-muted-foreground">{logged.rir}</span>
              </li>
            )
          })}
        </ul>
      </div>
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
