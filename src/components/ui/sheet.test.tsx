import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from './sheet'

/**
 * A *controlled* sheet opened from a control outside the dialog - the shape
 * every real sheet in this app uses (the nav FAB, the library filter chips).
 * There is deliberately no `SheetTrigger`.
 */
function ControlledSheet() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Quick actions">
        Open
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Quick actions</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('opens via the trigger and shows a dialog with the title as its accessible name', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Muscle</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Muscle')
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Muscle</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByText('Open'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * Radix only ever restores focus to a `<Dialog.Trigger>`, and preventDefaults
   * FocusScope's own restore on the way. A controlled sheet has no trigger, so
   * without our own restore focus lands on `<body>` and a keyboard or
   * screen-reader user loses their place (WCAG 2.4.3).
   */
  it.each(['Escape', 'close button', 'overlay'] as const)(
    'returns focus to the opening control when a controlled sheet is closed via %s',
    async (how) => {
      const user = userEvent.setup()
      render(<ControlledSheet />)

      const opener = screen.getByRole('button', { name: 'Quick actions' })
      opener.focus()
      await user.click(opener)
      await screen.findByRole('dialog')
      expect(opener).not.toHaveFocus()

      if (how === 'Escape') {
        await user.keyboard('{Escape}')
      } else if (how === 'close button') {
        await user.click(screen.getByRole('button', { name: 'Close' }))
      } else {
        // Radix puts `pointer-events: none` on the body while a modal is open,
        // so dismiss the overlay directly rather than through user-event's
        // pointer-events guard.
        const overlay = document.querySelector('[data-slot="sheet-overlay"]')!
        await user.pointer({ target: overlay, keys: '[MouseLeft]' })
      }

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(opener).toHaveFocus()
    },
  )

  it('still restores focus to an explicit SheetTrigger', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Muscle</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    const trigger = screen.getByText('Open')
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
