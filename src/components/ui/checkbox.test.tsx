import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '@/components/ui/checkbox'

describe('Checkbox', () => {
  it('row exposes role, state and label, and fires on click', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox size="row" checked={false} label="Mark Rest done" onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Mark Rest done' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it('ignores taps while disabled but stays focusable', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Checkbox size="row" checked={false} disabled label="Mark Rest done" onCheckedChange={onCheckedChange} />,
    )
    const box = screen.getByRole('checkbox', { name: 'Mark Rest done' })
    expect(box).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(box)
    await userEvent.keyboard(' ')
    expect(box).toHaveFocus()
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('reflects checked state', () => {
    render(<Checkbox size="row" checked label="Mark Rest not done" onCheckedChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Mark Rest not done' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('toggles from the keyboard', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox size="row" checked={false} label="Mark Rest done" onCheckedChange={onCheckedChange} />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it('block shows the label and secondary line, described by it', () => {
    render(
      <Checkbox
        size="block"
        checked={false}
        label="Mark rest day done"
        description="Moves you on to Pull B"
        onCheckedChange={() => {}}
      />,
    )
    const box = screen.getByRole('checkbox', { name: 'Mark rest day done' })
    expect(box).toHaveAccessibleDescription('Moves you on to Pull B')
    expect(screen.getByText('Mark rest day done')).toBeVisible()
  })
})
