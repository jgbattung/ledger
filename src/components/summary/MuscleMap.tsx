import type { CSSProperties } from 'react'
import { BACK, CENTRE, FRONT, HEAD, SILHOUETTE, type Region } from '@/components/library/bodyPaths'
import { ALL_MUSCLES } from '@/components/library/muscleGroups'
import { cn } from '@/lib/utils'
import type { Muscle } from '@/exercises/types'
import { heatStep, type HeatStep } from '@/workouts/summary'

/**
 * Front and back body heat map (design-system 14). Each primary muscle is
 * filled by the working sets that hit it: --heat-0 (none) through --heat-3.
 * Decorative: WorkedMuscles carries the exact counts as text.
 */

export type SetsByMuscle = Partial<Record<Muscle, number>>

const BODY_STYLE: CSSProperties = { fill: 'var(--heat-body)' }

const regionStyle = (step: HeatStep): CSSProperties => ({
  fill: `var(--heat-${step})`,
  stroke: 'var(--background)',
  strokeWidth: 0.8,
})

function Figure({
  regions,
  setsByMuscle,
  className,
}: {
  regions: Region[]
  setsByMuscle: SetsByMuscle
  className?: string
}) {
  return (
    <svg
      viewBox="10 2 80 198"
      aria-hidden="true"
      focusable="false"
      className={cn('block w-auto', className)}
    >
      <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} style={BODY_STYLE} />
      <path d={SILHOUETTE} style={BODY_STYLE} />
      <path d={SILHOUETTE} style={BODY_STYLE} transform={CENTRE} />
      {regions.map(({ muscle, d }) => {
        const step = muscle ? heatStep(setsByMuscle[muscle] ?? 0) : 0
        const style = regionStyle(step)
        return (
          <g
            key={muscle ?? d}
            data-muscle={muscle ?? undefined}
            data-heat={muscle ? step : undefined}
          >
            <path d={d} style={style} />
            <path d={d} style={style} transform={CENTRE} />
          </g>
        )
      })}
    </svg>
  )
}

export function MuscleMap({
  setsByMuscle,
  showViewLabels = false,
  figureClassName = 'h-[232px]',
  className,
}: {
  setsByMuscle: SetsByMuscle
  /** "Front" / "Back" captions under the figures. */
  showViewLabels?: boolean
  /** Height of each figure; the width follows the viewBox. */
  figureClassName?: string
  className?: string
}) {
  const views = [
    { label: 'Front', regions: FRONT },
    { label: 'Back', regions: BACK },
  ]
  return (
    <div className={cn('grid grid-cols-2 justify-items-center gap-1', className)}>
      {views.map(({ label, regions }) => (
        <div key={label} className="flex flex-col items-center">
          <Figure regions={regions} setsByMuscle={setsByMuscle} className={figureClassName} />
          {showViewLabels && (
            <span className="mt-0.5 text-center text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

const LEGEND: { step: HeatStep; label: string }[] = [
  { step: 1, label: '1–3 sets' },
  { step: 2, label: '4–6' },
  { step: 3, label: '7+' },
]

/** Three swatches naming the heat steps (summary page only). */
export function MuscleLegend({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground tabular-nums',
        className,
      )}
    >
      {LEGEND.map(({ step, label }) => (
        <li key={step} className="flex items-center gap-[5px]">
          <i
            aria-hidden="true"
            className="size-3 rounded-[3px]"
            style={{ background: `var(--heat-${step})` }}
          />
          {label}
        </li>
      ))}
    </ul>
  )
}

const sentenceCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

/** Muscles worked, most sets first (ties in ALL_MUSCLES order). */
function workedMuscles(setsByMuscle: SetsByMuscle): { muscle: Muscle; sets: number }[] {
  return ALL_MUSCLES.flatMap((muscle) => {
    const sets = setsByMuscle[muscle] ?? 0
    return sets > 0 ? [{ muscle, sets }] : []
  }).sort((a, b) => b.sets - a.sets)
}

/** "Chest 6 · Side delts 3 · Triceps 3": the exact counts behind the map. */
export function WorkedMuscles({
  setsByMuscle,
  className,
}: {
  setsByMuscle: SetsByMuscle
  className?: string
}) {
  const worked = workedMuscles(setsByMuscle)
  if (worked.length === 0) return null
  return (
    <p className={cn('text-center text-sm tabular-nums', className)}>
      {worked.map(({ muscle, sets }, index) => (
        <span key={muscle}>
          {index > 0 && <span className="text-muted-foreground"> · </span>}
          <span className="text-foreground">{sentenceCase(muscle)}</span>{' '}
          <span className="text-muted-foreground">{sets}</span>
        </span>
      ))}
    </p>
  )
}
