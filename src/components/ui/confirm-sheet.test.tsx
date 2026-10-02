import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmSheet } from './confirm-sheet'

function Harness({
  tone,
  onConfirm = () => {},
}: {
  tone: 'destructive' | 'neutral'
  onConfirm?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title="Delete program?"
        description="Logged workouts stay."
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone={tone}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
      />
    </>
  )
}

describe('ConfirmSheet', () => {
  it('shows title and description and calls onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness tone="neutral" onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'Delete program?' })).toBeInTheDocument()
    expect(screen.getByText('Logged workouts stay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cancel closes without confirming and focus returns to the opener', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness tone="destructive" onConfirm={onConfirm} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    // Focus never starts on the destructive action.
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('uses the destructive fill classes for the destructive tone only', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness tone="destructive" />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const destructive = screen.getByRole('button', { name: 'Delete' })
    expect(destructive).toHaveClass('bg-destructive', 'text-destructive-foreground')
    expect(destructive.className).toContain('dark:bg-destructive/15')
    expect(destructive.className).toContain('dark:text-destructive-tint-foreground')
    unmount()

    render(<Harness tone="neutral" />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveClass('bg-destructive')
  })
})
