import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseActionsSheet } from './ExerciseActionsSheet'

function renderSheet(isCustom: boolean) {
  render(<ExerciseActionsSheet open onOpenChange={() => {}} name="Curl" isCustom={isCustom} />)
  return screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close')
}

describe('ExerciseActionsSheet', () => {
  it('lists four disabled Soon rows in order for a bundled exercise', () => {
    const rows = renderSheet(false)
    expect(rows.map((r) => r.textContent)).toEqual([
      'Rest timerSoon',
      'Warm-up setsSoon',
      'Reset to defaultsSoon',
      'DuplicateSoon',
    ])
    rows.forEach((row) => expect(row).toBeDisabled())
  })

  it('adds a disabled Delete exercise row last for a custom exercise', () => {
    const rows = renderSheet(true)
    expect(rows).toHaveLength(5)
    expect(rows[4]).toHaveTextContent('Delete exercise')
    expect(rows[4]).toBeDisabled()
    expect(screen.getAllByText('Soon')).toHaveLength(5)
  })

  it('titles the sheet with the exercise name', () => {
    renderSheet(false)
    expect(screen.getByRole('dialog', { name: 'Curl' })).toBeInTheDocument()
  })
})
