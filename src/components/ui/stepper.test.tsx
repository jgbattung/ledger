import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Stepper, formatSeconds } from './stepper'

function ControlledStepper(props: {
  onValueChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  formatValue?: (v: number) => string
  initial?: number
}) {
  const { onValueChange, min = 0, max = 5, step = 1, formatValue, initial = 0 } = props
  const [value, setValue] = useState(initial)
  return (
    <Stepper
      value={value}
      onValueChange={(v) => {
        setValue(v)
        onValueChange(v)
      }}
      min={min}
      max={max}
      step={step}
      formatValue={formatValue}
      decrementLabel="Decrease value"
      incrementLabel="Increase value"
    />
  )
}

describe('formatSeconds', () => {
  it('formats total seconds as m:ss', () => {
    expect(formatSeconds(180)).toBe('3:00')
    expect(formatSeconds(90)).toBe('1:30')
    expect(formatSeconds(45)).toBe('0:45')
    expect(formatSeconds(600)).toBe('10:00')
  })
})

describe('Stepper', () => {
  it('increments and decrements by step', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ControlledStepper onValueChange={onValueChange} initial={2} />)

    await user.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onValueChange).toHaveBeenLastCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Decrease value' }))
    expect(onValueChange).toHaveBeenLastCalledWith(2)
  })

  it('clamps at min and max, disabling the bound button', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ControlledStepper onValueChange={onValueChange} min={0} max={2} initial={0} />)

    const decrementBtn = screen.getByRole('button', { name: 'Decrease value' })
    expect(decrementBtn).toBeDisabled()
    await user.click(decrementBtn)
    expect(onValueChange).not.toHaveBeenCalled()

    const incrementBtn = screen.getByRole('button', { name: 'Increase value' })
    await user.click(incrementBtn)
    await user.click(incrementBtn)
    expect(onValueChange).toHaveBeenLastCalledWith(2)
    expect(incrementBtn).toBeDisabled()

    await user.click(incrementBtn)
    expect(onValueChange).toHaveBeenCalledTimes(2)
  })

  it('respects a custom step size', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ControlledStepper onValueChange={onValueChange} min={30} max={600} step={15} initial={180} />)

    await user.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onValueChange).toHaveBeenLastCalledWith(195)
  })

  it('renders formatValue output (mm:ss for rest seconds)', () => {
    render(
      <ControlledStepper
        onValueChange={() => {}}
        min={30}
        max={600}
        step={15}
        initial={180}
        formatValue={formatSeconds}
      />,
    )
    expect(screen.getByText('3:00')).toBeInTheDocument()
  })

  it('exposes aria-labels on both buttons and aria-live on the value', () => {
    render(<ControlledStepper onValueChange={() => {}} initial={2} />)
    expect(screen.getByRole('button', { name: 'Decrease value' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase value' })).toBeInTheDocument()
    expect(screen.getByText('2')).toHaveAttribute('aria-live', 'polite')
  })
})
