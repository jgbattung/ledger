import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MuscleFigure } from './MuscleFigure'
import { ALL_MUSCLES, MUSCLE_CROP, MUSCLE_GROUPS, MUSCLE_VIEW } from './muscleGroups'
import type { Muscle } from '@/exercises/types'

const TAXONOMY: Muscle[] = [
  'chest',
  'lats',
  'upper back',
  'lower back',
  'traps',
  'front delts',
  'side delts',
  'rear delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
]

describe('muscle grouping', () => {
  it('covers all 19 muscles exactly once', () => {
    const listed = Object.values(MUSCLE_GROUPS).flatMap((groups) =>
      groups.flatMap((group) => group.muscles),
    )
    expect(listed).toHaveLength(19)
    expect([...listed].sort()).toEqual([...TAXONOMY].sort())
    expect(ALL_MUSCLES).toEqual(listed)
  })

  it('upper holds Chest, Back, Shoulders, Arms and Core; lower holds the six leg muscles', () => {
    expect(MUSCLE_GROUPS.upper.map((g) => g.label)).toEqual([
      'Chest',
      'Back',
      'Shoulders',
      'Arms',
      'Core',
    ])
    expect(MUSCLE_GROUPS.lower.flatMap((g) => g.muscles).sort()).toEqual(
      ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'].sort(),
    )
  })

  it('maps each muscle to exactly one view and one crop', () => {
    for (const muscle of TAXONOMY) {
      expect(['front', 'back']).toContain(MUSCLE_VIEW[muscle])
      expect(['upper', 'lower']).toContain(MUSCLE_CROP[muscle])
    }
    expect(Object.keys(MUSCLE_VIEW)).toHaveLength(19)
    expect(Object.keys(MUSCLE_CROP)).toHaveLength(19)
  })
})

describe('MuscleFigure', () => {
  it('is decorative', () => {
    const { container } = render(<MuscleFigure highlight={['chest']} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws a named region for every muscle of its view', () => {
    for (const muscle of TAXONOMY) {
      const { container, unmount } = render(<MuscleFigure highlight={[muscle]} />)
      expect(container.querySelector(`[data-muscle="${muscle}"]`), muscle).not.toBeNull()
      unmount()
    }
  })

  it('marks only the highlighted region', () => {
    const { container } = render(<MuscleFigure highlight={['quads']} crop="lower" />)
    const marked = [...container.querySelectorAll('[data-highlighted="true"]')]
    expect(marked.map((el) => el.getAttribute('data-muscle'))).toEqual(['quads'])
    expect(container.querySelectorAll('[data-highlighted="false"]').length).toBeGreaterThan(3)
  })

  it('picks the view and crop from the muscle, and honours an explicit crop', () => {
    const lats = render(<MuscleFigure highlight={['lats']} />).container.querySelector('svg')!
    expect(lats).toHaveAttribute('data-view', 'back')
    expect(lats).toHaveAttribute('data-crop', 'upper')
    const front = render(<MuscleFigure highlight={['chest']} crop="lower" />).container.querySelector(
      'svg',
    )!
    expect(front).toHaveAttribute('data-view', 'front')
    expect(front).toHaveAttribute('data-crop', 'lower')
  })
})
