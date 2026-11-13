import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldError } from './field-error'

describe('FieldError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<FieldError message={null} alert />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the message in ink with an alert icon, never destructive red (decision E)', () => {
    const { container } = render(<FieldError id="e" message="Enter a name." />)
    const message = screen.getByText('Enter a name.')
    expect(message).toHaveAttribute('id', 'e')
    expect(message).toHaveClass('text-foreground')
    expect(container.innerHTML).not.toMatch(/destructive/)
    expect(message.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces the message with role="alert" when asked', () => {
    render(<FieldError message="Pick at least one primary muscle." alert />)
    expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one primary muscle.')
  })
})
