import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseActionsSheet } from './ExerciseActionsSheet'

function renderSheet(isCustom: boolean, deleted = false) {
  const handlers = { onEdit: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() }
  render(
    <ExerciseActionsSheet
      open
      onOpenChange={() => {}}
      name="Curl"
      isCustom={isCustom}
      deleted={deleted}
      {...handlers}
    />,
  )
  const rows = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close')
  return { rows, ...handlers }
}

describe('ExerciseActionsSheet', () => {
  it('a bundled exercise has three Soon rows and an enabled Duplicate, no Edit or Delete', () => {
    const { rows } = renderSheet(false)
    expect(rows.map((r) => r.textContent)).toEqual([
      'Rest timerSoon',
      'Warm-up setsSoon',
      'Reset to defaultsSoon',
      'Duplicate',
    ])
    rows.slice(0, 3).forEach((row) => expect(row).toBeDisabled())
    expect(rows[3]).toBeEnabled()
  })

  it('a live custom exercise has Edit, Duplicate and Delete in that order after the Soon rows', async () => {
    const user = userEvent.setup()
    const { rows, onEdit, onDuplicate, onDelete } = renderSheet(true)
    expect(rows.map((r) => r.textContent)).toEqual([
      'Rest timerSoon',
      'Warm-up setsSoon',
      'Reset to defaultsSoon',
      'Edit exercise',
      'Duplicate',
      'Delete exercise',
    ])
    await user.click(rows[3])
    await user.click(rows[4])
    await user.click(rows[5])
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onDuplicate).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('a deleted custom exercise keeps Duplicate only', () => {
    const { rows } = renderSheet(true, true)
    expect(rows.map((r) => r.textContent)).toEqual([
      'Rest timerSoon',
      'Warm-up setsSoon',
      'Reset to defaultsSoon',
      'Duplicate',
    ])
  })

  it('titles the sheet with the exercise name', () => {
    renderSheet(false)
    expect(screen.getByRole('dialog', { name: 'Curl' })).toBeInTheDocument()
  })
})
