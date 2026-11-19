import { Fragment, type ReactNode, type Ref } from 'react'
import { format } from 'date-fns'
import { MuscleMap } from '@/components/summary/MuscleMap'
import { PartialDivider } from '@/components/session/SetRow'
import { APP_NAME } from '@/config/app'
import type { WorkoutSession } from '@/db/repos'
import { cn } from '@/lib/utils'
import { exerciseName } from '@/programs/model'
import {
  formatDuration,
  formatSetRuns,
  formatVolume,
  type SetRuns,
  type WorkoutSummary,
} from '@/workouts/summary'

export type ShareTemplate = 'map' | 'sticker' | 'ledger'

type CardExercise = { name: string; runs: SetRuns }

/** Exercises that have at least one logged working set, in workout order. */
function loggedExercises(exercises: WorkoutSession['exercises']): CardExercise[] {
  return exercises.flatMap(({ exercise, sets }) => {
    const runs = formatSetRuns(sets)
    return runs.runs.length > 0 ? [{ name: exerciseName(exercise.exerciseRef), runs }] : []
  })
}

/** "80 × 8, 8, 7|2" or "30 × 10 · 32 × 8 · 34 × 6"; no unit. */
function SetRunsLine({ runs }: { runs: SetRuns }) {
  return (
    <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground tabular-nums">
      {runs.prefix}
      {runs.runs.map((run, runIndex) => (
        <Fragment key={runIndex}>
          {runIndex > 0 ? ' · ' : null}
          {run.weight} ×{' '}
          {run.reps.map((reps, repIndex) => (
            <Fragment key={repIndex}>
              {repIndex > 0 ? ', ' : null}
              {reps.full}
              {reps.partial ? (
                <>
                  <PartialDivider />
                  {reps.partial}
                </>
              ) : null}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </p>
  )
}

function Volume({ summary }: { summary: WorkoutSummary }) {
  return (
    <>
      {formatVolume(summary.volumeKg)}
      <span className="ml-0.5 text-sm font-medium text-muted-foreground">kg</span>
    </>
  )
}

/** Three-cell hairline band (the summary's stat band at card scale). */
function Band({
  summary,
  labels,
  valueClass,
  className,
}: {
  summary: WorkoutSummary
  labels: [string, string, string]
  valueClass: string
  className?: string
}) {
  const cells: ReactNode[] = [
    summary.workingSets,
    <Volume key="volume" summary={summary} />,
    formatDuration(summary.durationMs),
  ]
  return (
    <dl className={cn('grid grid-cols-[auto_1fr_auto] border-t border-border', className)}>
      {cells.map((value, index) => (
        <div
          key={labels[index]}
          className="flex min-w-0 flex-col-reverse border-l border-border py-3 pr-3 pl-3 first:border-l-0 first:pl-0 last:pr-0"
        >
          <dt className="text-[13px] text-muted-foreground">{labels[index]}</dt>
          <dd className={cn('leading-tight font-semibold whitespace-nowrap tabular-nums', valueClass)}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MoreRow({ count }: { count: number }) {
  return count > 0 ? <li className="pt-1 text-[13px] text-muted-foreground">+{count} more</li> : null
}

function Header({ date }: { date: Date }) {
  return (
    <div className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
      <span className="font-semibold tracking-[0.01em] text-foreground">{APP_NAME}</span>
      <span>{format(date, 'EEE d MMM yyyy')}</span>
    </div>
  )
}

const MAP_LIMIT = 4
const LEDGER_LIMIT = 6

/**
 * The share image (design-system 14): exactly 360x640 CSS px, exported at 3x
 * to 1080x1920. Always dark whatever the app theme, so the root carries `.dark`
 * and every nested token resolves against it. The ref points at the real,
 * unscaled node that html-to-image exports; rounded preview corners and shadows
 * belong to the page wrapper, never to this node. Sticker is transparent.
 */
export function WorkoutShareCard({
  ref,
  template,
  session,
  summary,
}: {
  ref?: Ref<HTMLDivElement>
  template: ShareTemplate
  session: WorkoutSession
  summary: WorkoutSummary
}) {
  const { workout } = session
  const date = new Date(workout.startedAt)
  const exercises = loggedExercises(session.exercises)
  const root = 'dark flex h-[640px] w-[360px] flex-col overflow-hidden font-sans text-foreground'

  if (template === 'sticker') {
    return (
      <div ref={ref} className={cn(root, 'justify-end px-5 pt-6 pb-16')} data-template="sticker">
        <div className="rounded-[18px] bg-background px-4.5 pt-4.5 pb-1.5">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
            <span className="font-semibold tracking-[0.01em] text-foreground">{APP_NAME}</span>
            <span>
              {workout.name} · {format(date, 'd MMM')}
            </span>
          </div>
          <MuscleMap
            setsByMuscle={summary.setsByMuscle}
            figureClassName="h-[160px]"
            className="mt-2.5"
          />
          <Band
            summary={summary}
            labels={['Sets', 'Volume', 'Time']}
            valueClass="text-xl"
            className="mt-3"
          />
        </div>
      </div>
    )
  }

  if (template === 'ledger') {
    const shown = exercises.slice(0, LEDGER_LIMIT)
    const rows: [string, ReactNode][] = [
      ['Working sets', summary.workingSets],
      [
        'Volume',
        <>
          {formatVolume(summary.volumeKg)}
          <small className="ml-0.5 text-[15px] font-medium text-muted-foreground">kg</small>
        </>,
      ],
      ['Duration', formatDuration(summary.durationMs)],
    ]
    return (
      <div ref={ref} className={cn(root, 'bg-background px-6 pt-7 pb-6')} data-template="ledger">
        <Header date={date} />
        <h2 className="mt-4 text-[44px] leading-[1.1] font-semibold tracking-[-0.02em]">
          {workout.name}
        </h2>
        {workout.programName ? (
          <p className="text-sm text-muted-foreground">{workout.programName}</p>
        ) : null}
        <dl className="mt-4 border-t border-border">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                'flex items-baseline justify-between py-2',
                index === rows.length - 1
                  ? 'border-b-[3px] border-double border-foreground'
                  : 'border-b border-border',
              )}
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-[28px] leading-tight font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-2 min-h-0 flex-1 overflow-hidden">
          {shown.map((exercise, index) => (
            <li key={index} className="border-b border-border/60 py-1">
              <p className="truncate text-sm leading-snug font-medium">{exercise.name}</p>
              <SetRunsLine runs={exercise.runs} />
            </li>
          ))}
          <MoreRow count={exercises.length - shown.length} />
        </ul>
      </div>
    )
  }

  const shown = exercises.slice(0, MAP_LIMIT)
  return (
    <div ref={ref} className={cn(root, 'bg-background px-6 pt-7 pb-6')} data-template="map">
      <Header date={date} />
      <h2 className="mt-5 text-[34px] leading-tight font-semibold tracking-[-0.02em]">
        {workout.name}
      </h2>
      {workout.programName ? (
        <p className="text-sm text-muted-foreground">{workout.programName}</p>
      ) : null}
      <MuscleMap
        setsByMuscle={summary.setsByMuscle}
        figureClassName="h-[168px]"
        className="mt-3"
      />
      <Band
        summary={summary}
        labels={['Working sets', 'Volume', 'Duration']}
        valueClass="text-2xl"
        className="mt-3.5 border-b"
      />
      <ul className="mt-3 min-h-0 flex-1 overflow-hidden">
        {shown.map((exercise, index) => (
          <li key={index} className="py-1">
            <p className="truncate text-sm leading-snug font-medium">{exercise.name}</p>
            <SetRunsLine runs={exercise.runs} />
          </li>
        ))}
        <MoreRow count={exercises.length - shown.length} />
      </ul>
    </div>
  )
}
