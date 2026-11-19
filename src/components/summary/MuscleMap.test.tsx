import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MuscleMap } from './MuscleMap'
import { ALL_MUSCLES } from '@/components/library/muscleGroups'

describe('MuscleMap', () => {
  it('shades each muscle by its working sets: 1-3, 4-6, 7+, and unworked muscles at 0', () => {
    const { container } = render(
      <MuscleMap setsByMuscle={{ chest: 6, 'side delts': 3, triceps: 7, biceps: 1, quads: 4 }} />,
    )
    const expected: Record<string, string> = {
      chest: '2',
      'side delts': '1',
      triceps: '3',
      biceps: '1',
      quads: '2',
    }
    const heat = Object.fromEntries(
      ALL_MUSCLES.map((muscle) => {
        const regions = [...container.querySelectorAll(`[data-muscle="${muscle}"]`)]
        expect(regions.length, muscle).toBeGreaterThan(0)
        const steps = new Set(regions.map((region) => region.getAttribute('data-heat')))
        expect(steps.size, muscle).toBe(1)
        return [muscle, [...steps][0]]
      }),
    )
    expect(heat).toEqual(
      Object.fromEntries(ALL_MUSCLES.map((muscle) => [muscle, expected[muscle] ?? '0'])),
    )
  })
})
