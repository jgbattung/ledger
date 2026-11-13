import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetDb } from '@/db/test-utils'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { useProgramDraftStore } from '@/stores/programDraftStore'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'
import { renderEditor, seedProgram } from './editorTestUtils'

type User = ReturnType<typeof userEvent.setup>

/**
 * The picker renders the whole catalog, and accessible-name queries over every
 * row dominate jsdom time. Narrow the list with one paste (not per-key typing)
 * and wait for the deferred query to settle on a known row.
 */
async function narrowTo(user: User, query: string) {
  await user.click(screen.getByLabelText('Search exercises'))
  await user.paste(query)
  await screen.findByRole('button', { name: /^Incline Barbell Bench Press/ })
}

/** Opens the picker for the first day of a seeded program through the editor link. */
async function openPicker(user: User) {
  const id = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
  const router = renderEditor(`/programs/${id}`)
  await user.click(await screen.findByRole('link', { name: 'Add exercises' }))
  await screen.findByRole('heading', { name: 'Add to Push' })
  await narrowTo(user, 'Bench Press')
  return router
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp('^' + name) })

describe('ExercisePickerPage', () => {
  beforeEach(async () => {
    await resetDb()
    useProgramDraftStore.getState().reset()
    await resetAndHydrateCustomExercises()
  })

  it('numbers selections in order, shows the tray and the add button', async () => {
    const user = userEvent.setup()
    await openPicker(user)
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(row('Decline Barbell Bench Press'))
    expect(row('Incline Barbell Bench Press')).toHaveTextContent('1')
    expect(row('Decline Barbell Bench Press')).toHaveTextContent('2')
    expect(row('Incline Barbell Bench Press')).toHaveAttribute('aria-pressed', 'true')
    const tray = screen.getByRole('list', { name: 'Selected exercises' })
    expect(within(tray).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Add 2 exercises' })).toBeInTheDocument()
  })

  it('hides the bottom bar until something is selected', async () => {
    const user = userEvent.setup()
    await openPicker(user)
    expect(screen.queryByRole('list', { name: 'Selected exercises' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add \d/ })).not.toBeInTheDocument()
  })

  it('deselecting #1 renumbers the remaining selection to 1', async () => {
    const user = userEvent.setup()
    await openPicker(user)
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(row('Decline Barbell Bench Press'))
    await user.click(row('Incline Barbell Bench Press'))
    expect(row('Decline Barbell Bench Press')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Add 1 exercise' })).toBeInTheDocument()
  })

  it('a tray x deselects', async () => {
    const user = userEvent.setup()
    await openPicker(user)
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(screen.getByRole('button', { name: 'Remove Incline Barbell Bench Press from selection' }))
    expect(row('Incline Barbell Bench Press')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('list', { name: 'Selected exercises' })).not.toBeInTheDocument()
  })

  it('an exercise already in the day is disabled with a hint', async () => {
    const user = userEvent.setup()
    await openPicker(user)
    await user.clear(screen.getByLabelText('Search exercises'))
    await narrowTo(user, 'Barbell Bench Press')
    const existing = await screen.findByRole('button', { name: /^Barbell Bench Press/ })
    expect(existing).toBeDisabled()
    expect(existing).toHaveTextContent('Already in Push')
  })

  it('Add appends in selection order to the draft day and returns to the editor', async () => {
    const user = userEvent.setup()
    const router = await openPicker(user)
    await user.click(row('Decline Barbell Bench Press'))
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(screen.getByRole('button', { name: 'Add 2 exercises' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programs\/[^/]+$/))
    expect(await screen.findByText('3 exercises')).toBeInTheDocument()
    const names = useProgramDraftStore
      .getState()
      .draft!.days[0].exercises.map((e) => e.exerciseRef.exerciseId)
    expect(names).toEqual(['barbell-bench-press', 'decline-barbell-bench-press', 'incline-barbell-bench-press'])
  })

  it('Back adds nothing', async () => {
    const user = userEvent.setup()
    const router = await openPicker(user)
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programs\/[^/]+$/))
    expect(await screen.findByText('1 exercise')).toBeInTheDocument()
  })

  it('visiting the picker with no draft redirects to the editor', async () => {
    const id = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
    const router = renderEditor(`/programs/${id}/exercises?day=whatever`)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/programs/${id}`))
    expect(await screen.findByRole('tablist')).toBeInTheDocument()
  })

  it('an unknown day redirects to the editor', async () => {
    const user = userEvent.setup()
    const router = await openPicker(user)
    await router.navigate(`${router.state.location.pathname}?day=nope`)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programs\/[^/]+$/))
  })

  it('works on /programs/new: Add returns to the same draft without re-opening the name prompt', async () => {
    const user = userEvent.setup()
    const router = renderEditor('/programs/new')
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('link', { name: 'Add exercises' }))
    await screen.findByRole('heading', { name: /^Add to / })
    expect(router.state.location.pathname).toBe('/programs/new/exercises')
    expect(router.state.location.search).toMatch(/^[?]day=.+/)
    await narrowTo(user, 'Incline Barbell Bench')
    await user.click(row('Incline Barbell Bench Press'))
    await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/programs/new'))
    expect(await screen.findByText('1 exercise')).toBeInTheDocument()
    expect(screen.queryByLabelText('Program name')).not.toBeInTheDocument()
    const draft = useProgramDraftStore.getState().draft!
    expect(draft.isNew).toBe(true)
    expect(draft.days[0].exercises.map((e) => e.exerciseRef.exerciseId)).toEqual([
      'incline-barbell-bench-press',
    ])
  })

  describe('custom exercises', () => {
    const input = {
      name: 'SSB Squat',
      primaryMuscles: ['quads' as const],
      secondaryMuscles: [],
      mechanic: 'compound' as const,
    }

    async function openPickerFor(user: User, query: string) {
      const id = await seedProgram('PPL', [{ name: 'Push', ids: ['barbell-bench-press'] }])
      const router = renderEditor(`/programs/${id}`)
      await user.click(await screen.findByRole('link', { name: 'Add exercises' }))
      await screen.findByRole('heading', { name: 'Add to Push' })
      await user.click(screen.getByLabelText('Search exercises'))
      await user.paste(query)
      return { router, id }
    }

    it('picks a custom exercise and adds it to the day as a custom ref', async () => {
      const created = await useCustomExerciseStore.getState().create(input)
      const user = userEvent.setup()
      const { router } = await openPickerFor(user, 'ssb')
      await user.click(await screen.findByRole('button', { name: /^SSB Squat/ }))
      await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }))
      await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programs\/[^/]+$/))
      expect(useProgramDraftStore.getState().draft!.days[0].exercises.at(-1)!.exerciseRef).toEqual({
        source: 'custom',
        exerciseId: created.id,
      })
    })

    it('disables a custom exercise already in the day', async () => {
      const created = await useCustomExerciseStore.getState().create(input)
      const id = await seedProgram('PPL', [{ name: 'Push', ids: [] }])
      const user = userEvent.setup()
      const router = renderEditor(`/programs/${id}`)
      await screen.findByRole('link', { name: 'Add exercises' })
      const dayId = useProgramDraftStore.getState().draft!.days[0].id
      useProgramDraftStore
        .getState()
        .addExercises(dayId, [{ source: 'custom', exerciseId: created.id }])
      await router.navigate(`/programs/${id}/exercises?day=${dayId}`)
      await screen.findByRole('heading', { name: 'Add to Push' })
      await user.click(screen.getByLabelText('Search exercises'))
      await user.paste('ssb')
      const existing = await screen.findByRole('button', { name: /^SSB Squat/ })
      expect(existing).toBeDisabled()
      expect(existing).toHaveTextContent('Already in Push')
    })

    it('keeps the selection across an unmount and remount, and Back clears it', async () => {
      await useCustomExerciseStore.getState().create(input)
      const user = userEvent.setup()
      const { router, id } = await openPickerFor(user, 'ssb')
      await user.click(await screen.findByRole('button', { name: /^SSB Squat/ }))
      expect(useProgramDraftStore.getState().pickerSelection).toHaveLength(1)

      const dayId = useProgramDraftStore.getState().draft!.days[0].id
      await router.navigate(`/programs/${id}`)
      await screen.findByRole('tablist')
      await router.navigate(`/programs/${id}/exercises?day=${dayId}`)
      await screen.findByRole('heading', { name: 'Add to Push' })
      expect(await screen.findByRole('button', { name: 'Add 1 exercise' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(useProgramDraftStore.getState().pickerSelection).toEqual([])
    })
  })
})
