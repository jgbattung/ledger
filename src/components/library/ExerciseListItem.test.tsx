import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseListItem } from './ExerciseListItem'
import type { Exercise } from '@/exercises/types'

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'test-exercise',
    name: 'Test Exercise',
    aliases: [],
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: 'barbell',
    category: 'strength',
    mechanic: 'compound',
    instructions: ['Do it.'],
    images: ['Test_Exercise/0.jpg'],
    ...overrides,
  }
}

describe('ExerciseListItem', () => {
  it('renders an image when the exercise has one', () => {
    const { container } = render(<ExerciseListItem exercise={makeExercise()} />)
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders a placeholder glyph (no img tag) when the exercise has no images', () => {
    const { container, getByText } = render(
      <ExerciseListItem exercise={makeExercise({ images: [] })} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(getByText('Test Exercise')).toBeInTheDocument()
  })
})
