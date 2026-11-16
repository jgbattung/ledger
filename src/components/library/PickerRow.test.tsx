import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PickerRow } from '@/components/library/PickerRow'
import type { ListedExercise } from '@/exercises/listing'

const exercise: ListedExercise = {
  ref: { source: 'db', exerciseId: 'barbell-curl' },
  name: 'Barbell Curl',
  primaryMuscles: ['biceps'],
  equipment: 'barbell',
  images: [],
  isCustom: false,
} as unknown as ListedExercise

function renderRow(props: Partial<Parameters<typeof PickerRow>[0]> = {}) {
  const onSelect = vi.fn()
  render(
    <MemoryRouter initialEntries={['/picker']}>
      <Routes>
        <Route
          path="/picker"
          element={<PickerRow exercise={exercise} multi onSelect={onSelect} {...props} />}
        />
        <Route path="/exercises/:source/:exerciseId" element={<p>Exercise page</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return onSelect
}

describe('PickerRow', () => {
  it('tapping the name opens the exercise page and does not select', async () => {
    const user = userEvent.setup()
    const onSelect = renderRow()
    await user.click(screen.getByRole('link', { name: /^Barbell Curl/ }))
    expect(await screen.findByText('Exercise page')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('tapping the circle selects and stays put', async () => {
    const user = userEvent.setup()
    const onSelect = renderRow()
    await user.click(screen.getByRole('button', { name: 'Select Barbell Curl' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Exercise page')).not.toBeInTheDocument()
  })

  it('shows the order, aria-pressed and a Deselect label when picked', () => {
    renderRow({ order: 2 })
    const circle = screen.getByRole('button', { name: 'Deselect Barbell Curl' })
    expect(circle).toHaveTextContent('2')
    expect(circle).toHaveAttribute('aria-pressed', 'true')
  })

  it('single-choice rows have no number and no pressed state', () => {
    renderRow({ multi: false, order: 1 })
    const circle = screen.getByRole('button', { name: /Barbell Curl/ })
    expect(circle).toHaveTextContent('')
    expect(circle).not.toHaveAttribute('aria-pressed')
  })

  it('a disabled row keeps its link but its circle cannot select', async () => {
    const user = userEvent.setup()
    const onSelect = renderRow({ disabled: true, subtitle: 'Already in Push' })
    const circle = screen.getByRole('button', { name: 'Select Barbell Curl' })
    expect(circle).toBeDisabled()
    await user.click(circle)
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: /Already in Push/ }))
    expect(await screen.findByText('Exercise page')).toBeInTheDocument()
  })
})
