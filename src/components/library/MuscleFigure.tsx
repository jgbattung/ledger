import type { CSSProperties } from 'react'
import { MUSCLE_CROP, MUSCLE_VIEW, type BodyHalf, type BodyView } from './muscleGroups'
import type { Muscle } from '@/exercises/types'

/**
 * Body figure for one muscle (design-system 13f): front and back views in one
 * 100x200 space, each drawn as a left half and mirrored so the body is exactly
 * symmetric. Every region is outlined; the highlighted ones are filled with
 * `primary`. Colours are token mixes only, so both themes work. Decorative:
 * the tile label carries the muscle's name.
 */

const CENTRE = 'matrix(-1 0 0 1 100 0)'

/** Left half of the silhouette, closed along the centre line (a hair past it
 * so the mirrored halves overlap and never leave a seam). */
const SILHOUETTE =
  'M45 22 C45 26 45 29 44 31 C38 33 29 34 25 38 C21.5 41 20 46 19.5 52 L18 72 C17.5 76 16.5 80 15.5 84 L12.5 104 C12 108 11.5 111 12 114 C12.5 119 14 121 16 120 C17.5 119 18 117 18.5 113 L22 92 C23 88 24 85 24.5 82 C25 76 26 68 27 62 C28 58 28.5 57 28.5 56 C28.5 60 30 70 31.5 80 C32 85 33 88 33 92 C32 100 30.5 106 30.5 112 C30 125 30.5 140 32 152 L33 160 C32.5 168 32.5 176 35 186 L36.5 190 C36 194 34.5 196 34.5 198 L45 198 C45.5 196 44.5 193 44.5 190 C44 180 45 172 45.5 162 L46 158 C47 145 48.5 130 49.5 116 L50.4 112 L50.4 22 Z'

/** Context shapes drawn as muscle tone but never highlighted. */
const FOREARM =
  'M18 83 C16.3 88 14.4 96 13.2 105 L12.3 111 L17.3 112.5 C19 104 22 93 23.5 85 C21.5 84 19.5 82.8 18 83 Z'
const SHIN =
  'M36.6 158 C39.5 156.5 43.5 157 45 160 C45.5 169 44.5 178 42.5 184 C40 184.5 38.3 182 37.5 177 C36.5 171 36.3 164 36.6 158 Z'

type Region = { muscle: Muscle | null; d: string }

const FRONT: Region[] = [
  { muscle: 'chest', d: 'M49.5 38.5 C44 37.5 37 38 31.5 41.5 C30.5 46 30.8 52 34 56 C38 59.5 45 59.5 49.5 57 Z' },
  {
    muscle: 'side delts',
    d: 'M25 38 C21.5 41 20 46 19.5 52 C19.8 55 21.5 57 23.3 57 C23 51 24.3 45 27 40.5 C26.5 39 25.7 38.4 25 38 Z',
  },
  {
    muscle: 'front delts',
    d: 'M27.3 40.2 C29.5 39.3 31.5 40 32 41.5 C32 47 30.5 53 27.5 57.5 C25.5 58 23.8 57.5 23.6 57 C23.4 51 24.6 45 27.3 40.2 Z',
  },
  {
    muscle: 'biceps',
    d: 'M23.5 59 C21.5 62 20.5 67 20.8 73 C21.3 77 23.5 78.5 25.3 77 C26.5 72 27 66 26.5 60.5 C25.5 58.5 24.5 58.3 23.5 59 Z',
  },
  { muscle: 'forearms', d: FOREARM },
  {
    muscle: 'abs',
    d: 'M49.8 61 C47.5 60.3 45 60.5 43.5 62 L44 98 C46 100 48.5 100.5 49.8 100 Z',
  },
  {
    muscle: 'obliques',
    d: 'M42.2 63.5 C39 63 35.5 62 33.2 60.5 C32.6 70 33 80 34.3 90 C35.5 95 38.5 98 42.5 98.5 C42.5 88 42.5 75 42.2 63.5 Z',
  },
  {
    muscle: 'quads',
    d: 'M33 114 C36.5 111 42.5 111.5 45.8 114.5 C46.3 128 45.4 141 43.5 152.5 C40.5 155 36.5 154 34.8 151 C32.5 140 31.8 126 33 114 Z',
  },
  {
    muscle: 'adductors',
    d: 'M46.9 115.5 L49.4 114 C49.4 124 48.4 135 46.4 146 C45.8 138 45.8 126 46.9 115.5 Z',
  },
  { muscle: null, d: SHIN },
]

const BACK: Region[] = [
  {
    muscle: 'traps',
    d: 'M49.8 24 C47 26 46 28 45.5 30.5 C42 33 37 35 33.5 37 C38 40 44 46 49.8 60 Z',
  },
  {
    muscle: 'rear delts',
    d: 'M26.2 37.8 C22.8 40 20.6 45 20 51.5 C20.5 55.5 23 57.2 26 56 C29.5 53.5 32 48.5 32.3 44 C32 40.5 29.5 38.2 26.2 37.8 Z',
  },
  {
    muscle: 'upper back',
    d: 'M48.8 46 C44.5 45 39 45.5 35 48.5 C35.2 56 40 64 48.8 68 Z',
  },
  {
    muscle: 'lats',
    d: 'M33 56.5 C33.6 66 36.2 76 40.8 85 C42.5 84.5 43.8 83 44 81 C44.2 77 44 74 43.5 71.5 C40 68 36 62.5 33 56.5 Z',
  },
  {
    muscle: 'lower back',
    d: 'M49.8 73 C47.5 72.5 45.5 74.5 45.2 78 C45 88 45.2 96 45.8 101 L49.8 101.8 Z',
  },
  {
    muscle: 'triceps',
    d: 'M24 58.5 C22 61.5 21 67 21.2 73 C21.7 77 24 78.5 25.8 77 C27 72 27.3 66 26.8 60.5 C26 58.4 25 58 24 58.5 Z',
  },
  { muscle: null, d: FOREARM },
  {
    muscle: 'abductors',
    d: 'M32.3 96.5 C36 94 42 94.5 46.5 98.5 C42 101.5 36.5 102 33 104 C32 101.5 31.8 99 32.3 96.5 Z',
  },
  {
    muscle: 'glutes',
    d: 'M33.5 102.5 C38 100 45 100.5 49.8 103.5 L49.8 122 C45 126 38 125.5 34.5 121 C32.6 116 32.7 108 33.5 102.5 Z',
  },
  {
    muscle: 'hamstrings',
    d: 'M34 127 C38 129 44 129 47.5 127 C47.5 136 46.5 146 44.5 153.5 C41 155.5 37.5 154 36 150 C34 142 33.2 134 34 127 Z',
  },
  {
    muscle: 'calves',
    d: 'M34.6 160.5 C37.8 157.5 43 157.5 45.4 161.5 C46.2 170 45.2 177 42.4 183 C39.2 183 36.2 179 34.8 173 C33.9 168.5 33.8 164 34.6 160.5 Z',
  },
]

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
      <ellipse cx="50" cy="14.5" rx="9.2" ry="11.5" style={BODY_STYLE} />
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
