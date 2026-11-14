import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseListItem } from './ExerciseListItem'
import type { ListedExercise } from '@/exercises/listing'

function makeExercise(overrides: Partial<ListedExercise> = {}): ListedExercise {
  return {
    ref: { source: 'db', exerciseId: 'test-exercise' },
    isCustom: false,
    name: 'Test Exercise',
    aliases: [],
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: 'barbell',
    category: 'strength',
    mechanic: 'compound',
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

  it('renders a trailing slot after the text', () => {
    const { getByRole } = render(
      <ExerciseListItem exercise={makeExercise()} trailing={<button type="button">Remove</button>} />,
    )
    expect(getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('applies muted styling to the name and thumbnail', () => {
    const { getByText, container } = render(<ExerciseListItem exercise={makeExercise()} muted />)
    expect(getByText('Test Exercise')).toHaveClass('text-muted-foreground')
    expect(container.querySelector('img')).toHaveClass('grayscale')
  })

  it('shows a custom subtitle in place of the meta line', () => {
    const { getByText, queryByText } = render(
      <ExerciseListItem exercise={makeExercise()} subtitle="Already in Push" />,
    )
    expect(getByText('Already in Push')).toBeInTheDocument()
    expect(queryByText(/Chest/)).toBeNull()
  })

  it('shows the Custom pill only for a custom exercise', () => {
    const custom = render(
      <ExerciseListItem
        exercise={makeExercise({ isCustom: true, ref: { source: 'custom', exerciseId: 'c1' }, images: [] })}
      />,
    )
    expect(custom.getByText('Custom')).toBeInTheDocument()
    custom.unmount()
    const bundled = render(<ExerciseListItem exercise={makeExercise()} />)
    expect(bundled.queryByText('Custom')).toBeNull()
  })
})
