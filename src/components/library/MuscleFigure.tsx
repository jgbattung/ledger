import type { CSSProperties } from 'react'
import { MUSCLE_CROP, MUSCLE_VIEW, type BodyHalf, type BodyView } from './muscleGroups'
import { BACK, CENTRE, FRONT, HEAD, SILHOUETTE, type Region } from './bodyPaths'
import type { Muscle } from '@/exercises/types'

/**
 * Body figure for one muscle (design-system 13f): front and back views in one
 * 100x200 space, each drawn as a left half and mirrored so the body is exactly
 * symmetric. Every region is outlined; the highlighted ones are filled with
 * `primary`. Colours are token mixes only, so both themes work. Decorative:
 * the tile label carries the muscle's name.
 */

const VIEWS: Record<BodyView, Region[]> = { front: FRONT, back: BACK }

const CROP_BOX: Record<BodyHalf, string> = {
  upper: '8 4 84 104',
  lower: '14 92 72 108',
}

const BODY_STYLE: CSSProperties = {
  fill: 'color-mix(in oklch, var(--muted-foreground) 28%, var(--background))',
}
const REGION_STYLE: CSSProperties = {
  fill: 'color-mix(in oklch, var(--muted-foreground) 48%, var(--background))',
  stroke: 'var(--background)',
  strokeWidth: 0.8,
}
const HIT_STYLE: CSSProperties = {
  fill: 'var(--primary)',
  stroke: 'var(--background)',
  strokeWidth: 0.8,
}

export function MuscleFigure({
  highlight,
  crop,
  view: viewProp,
  className,
}: {
  highlight: Muscle[]
  /** Defaults to the half the first highlighted muscle belongs to. */
  crop?: BodyHalf
  /** Defaults to the view that draws the first highlighted muscle. Pass it
   * when nothing is highlighted but the figure still stands for a muscle. */
  view?: BodyView
  className?: string
}) {
  const half = crop ?? (highlight[0] ? MUSCLE_CROP[highlight[0]] : 'upper')
  const view: BodyView = viewProp ?? (highlight[0] ? MUSCLE_VIEW[highlight[0]] : 'front')

  return (
    <svg
      viewBox={CROP_BOX[half]}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-view={view}
      data-crop={half}
    >
      <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} style={BODY_STYLE} />
      <path d={SILHOUETTE} style={BODY_STYLE} />
      <path d={SILHOUETTE} style={BODY_STYLE} transform={CENTRE} />
      {VIEWS[view].map(({ muscle, d }) => {
        const hit = muscle !== null && highlight.includes(muscle)
        const style = hit ? HIT_STYLE : REGION_STYLE
        return (
          <g
            key={muscle ?? d}
            data-muscle={muscle ?? undefined}
            data-highlighted={muscle ? String(hit) : undefined}
          >
            <path d={d} style={style} />
            <path d={d} style={style} transform={CENTRE} />
          </g>
        )
      })}
    </svg>
  )
}
