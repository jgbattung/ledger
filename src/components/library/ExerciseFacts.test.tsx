import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseFacts } from './ExerciseFacts'

const bundled = {
  primaryMuscles: ['chest'],
  secondaryMuscles: ['front delts', 'triceps'],
  equipment: 'dumbbell',
  category: 'strength',
  mechanic: 'compound',
}

describe('ExerciseFacts', () => {
  it('renders every row for a bundled exercise', () => {
    render(<ExerciseFacts detail={bundled} />)
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText('Front Delts, Triceps')).toBeInTheDocument()
    expect(screen.getByText('Dumbbell')).toBeInTheDocument()
    expect(screen.getByText('Strength · Compound')).toBeInTheDocument()
  })

  it('omits Secondary when there are no secondary muscles', () => {
    render(<ExerciseFacts detail={{ ...bundled, secondaryMuscles: [] }} />)
    expect(screen.queryByText('Secondary')).toBeNull()
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('omits Type for a custom exercise', () => {
    render(
      <ExerciseFacts
        detail={{ primaryMuscles: ['hamstrings'], secondaryMuscles: [], equipment: 'machine' }}
      />,
    )
    expect(screen.queryByText('Type')).toBeNull()
    expect(screen.getByText('Machine')).toBeInTheDocument()
  })
})
