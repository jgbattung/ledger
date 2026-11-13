import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { selectIsDirty, useCustomExerciseFormStore } from '@/stores/customExerciseFormStore'

const form = () => useCustomExerciseFormStore.getState()
const dirty = () => selectIsDirty(form())

describe('customExerciseFormStore', () => {
  beforeEach(async () => {
    await resetDb()
    useCustomExerciseStore.setState({ byId: {}, hydrated: false })
    form().reset()
    useCustomExerciseFormStore.setState({ pendingPick: null })
  })

  it('duplicating a bundled exercise prefills "name copy" with its muscles, equipment and mechanic', () => {
    form().start({ mode: 'duplicate', from: { source: 'db', exerciseId: 'barbell-squat' } })
    const { draft, mode } = form()
    expect(mode).toBe('duplicate')
    expect(draft.name).toBe('Barbell Squat copy')
    expect(draft.primaryMuscles).toEqual(['quads'])
    expect(draft.secondaryMuscles).toContain('glutes')
    expect(draft.equipmentTag).toBe('barbell')
    expect(draft.mechanic).toBe('compound')
    expect(draft.notes).toBe('')
  })

  it('duplicating a custom exercise copies its values but not its notes', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: ['glutes'],
      equipmentTag: 'barbell',
      mechanic: 'compound',
      notes: 'Safety squat bar',
    })
    form().start({ mode: 'duplicate', from: { source: 'custom', exerciseId: row.id } })
    expect(form().draft).toMatchObject({ name: 'SSB Squat copy', notes: '' })
  })

  it('edit prefills the row, notes included', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      mechanic: 'compound',
      notes: 'Safety squat bar',
    })
    form().start({ mode: 'edit', editingId: row.id })
    expect(form().editingId).toBe(row.id)
    expect(form().draft).toMatchObject({
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      notes: 'Safety squat bar',
      mechanic: 'compound',
    })
  })

  it('new prefills only the name and remembers the picker origin', () => {
    form().start({ mode: 'new', name: 'ssb squat', pickOrigin: 'program' })
    expect(form().draft.name).toBe('ssb squat')
    expect(form().pickOrigin).toBe('program')
    expect(form().draft.primaryMuscles).toEqual([])
  })

  it('adding a primary removes it from secondary, and secondary never takes a primary', () => {
    form().start({ mode: 'new' })
    form().setSecondaryMuscles(['glutes', 'calves'])
    form().setPrimaryMuscles(['glutes'])
    expect(form().draft.secondaryMuscles).toEqual(['calves'])
    form().setSecondaryMuscles(['glutes', 'calves', 'abs'])
    expect(form().draft.secondaryMuscles).toEqual(['calves', 'abs'])
  })

  it('is clean right after start and dirty after any change', () => {
    form().start({ mode: 'new', name: 'x' })
    expect(dirty()).toBe(false)
    form().setNotes('hi')
    expect(dirty()).toBe(true)
    form().start({ mode: 'new', name: 'x' })
    form().setMechanic('isolation')
    expect(dirty()).toBe(true)
  })

  it('reset clears the form but keeps the pending pick until consumed', () => {
    form().start({ mode: 'new', name: 'x' })
    form().setPendingPick({ source: 'custom', exerciseId: 'abc' })
    form().reset()
    expect(form().mode).toBeNull()
    expect(form().draft.name).toBe('')
    expect(form().consumePendingPick()).toEqual({ source: 'custom', exerciseId: 'abc' })
    expect(form().consumePendingPick()).toBeNull()
  })
})
