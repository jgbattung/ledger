import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseStrip } from '@/components/session/ExerciseStrip'
import type { SessionExercise } from '@/stores/sessionStore'

const entry = (id: string, exerciseId: string): SessionExercise => ({
  exercise: {
    id,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    workoutId: 'w',
    orderIndex: 0,
    exerciseRef: { source: 'db', exerciseId },
  },
  sets: [],
})

describe('ExerciseStrip add tile', () => {
  const exercises = [entry('a', 'barbell-bench-press'), entry('b', 'pull-up')]

  it('renders an Add exercise tile after the last exercise tile and calls onAdd', async () => {
    const onAdd = vi.fn()
    render(<ExerciseStrip exercises={exercises} focusedId="a" onFocus={() => {}} onAdd={onAdd} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Barbell Bench Press',
      'Pull-Up',
      'Add exercise',
    ])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add exercise' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('never takes aria-current and leaves the indicator on the focused exercise', () => {
    render(<ExerciseStrip exercises={exercises} focusedId="b" onFocus={() => {}} onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: 'Add exercise' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Pull-Up' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('strip-indicator').style.transform).toContain('1 *')
  })
})
