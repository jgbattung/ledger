import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from './segmented-control'

const OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const

/** Controlled wrapper so keyboard navigation reflects real (parent-managed) state. */
function ControlledHarness({ onValueChange }: { onValueChange: (v: 'kg' | 'lb') => void }) {
  const [value, setValue] = useState<'kg' | 'lb'>('kg')
  return (
    <SegmentedControl
      value={value}
      onValueChange={(v) => {
        setValue(v)
        onValueChange(v)
      }}
      options={OPTIONS}
      aria-label="Units"
    />
  )
}

describe('SegmentedControl', () => {
  it('renders radiogroup and radio roles with aria-checked tracking the value', () => {
    render(
      <SegmentedControl
        value="kg"
        onValueChange={() => {}}
        options={OPTIONS}
        aria-label="Units"
      />,
    )

    const group = screen.getByRole('radiogroup', { name: 'Units' })
    expect(group).toBeInTheDocument()

    const kg = screen.getByRole('radio', { name: 'kg' })
    const lb = screen.getByRole('radio', { name: 'lb' })
    expect(kg).toHaveAttribute('aria-checked', 'true')
    expect(lb).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onValueChange with the clicked option', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SegmentedControl
        value="kg"
        onValueChange={onValueChange}
        options={OPTIONS}
        aria-label="Units"
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'lb' }))
    expect(onValueChange).toHaveBeenCalledWith('lb')
  })

  it('moves and selects with arrow keys, managing roving tabindex', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ControlledHarness onValueChange={onValueChange} />)

    const kg = screen.getByRole('radio', { name: 'kg' })
    const lb = screen.getByRole('radio', { name: 'lb' })
    expect(kg).toHaveAttribute('tabindex', '0')
    expect(lb).toHaveAttribute('tabindex', '-1')

    kg.focus()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('lb')
    expect(screen.getByRole('radio', { name: 'lb' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(onValueChange).toHaveBeenLastCalledWith('kg')
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveFocus()
  })

  it('gives every segment the min-h-touch-min class', () => {
    render(
      <SegmentedControl
        value="kg"
        onValueChange={() => {}}
        options={OPTIONS}
        aria-label="Units"
      />,
    )

    for (const label of ['kg', 'lb']) {
      expect(screen.getByRole('radio', { name: label }).className).toContain('min-h-touch-min')
    }
  })
})
