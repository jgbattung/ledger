import { describe, expect, it } from 'vitest'
import { formatWeight, fromDisplay } from '@/workouts/units'

describe('units (LOG-15)', () => {
  it('shows a stored 100 kg as 220.5 lb and as exactly 100 kg', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5')
    expect(formatWeight(100, 'kg')).toBe('100')
  })

  it('stores 135 lb as full-precision kg that shows as 135 lb again', () => {
    const kg = fromDisplay(135, 'lb')
    expect(kg).toBeCloseTo(61.23496995, 8)
    expect(formatWeight(kg, 'lb')).toBe('135')
  })
})
