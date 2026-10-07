import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { selectIsDirty, useProgramDraftStore } from './programDraftStore'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })
const store = () => useProgramDraftStore.getState()
const dirty = () => selectIsDirty(store())
const draft = () => store().draft!

describe('programDraftStore', () => {
  beforeEach(async () => {
    await resetDb()
    store().reset()
  })

  it('startNew is not dirty, and a rename makes it dirty', () => {
    store().startNew()
    expect(store().namePromptOpen).toBe(true)
    expect(dirty()).toBe(false)
    store().setName('Push Pull Legs')
    expect(dirty()).toBe(true)
  })

  it('load() with no edits is not dirty', async () => {
    store().startNew()
    await store().commit()
    const id = draft().id
    store().reset()
    expect(await store().load(id)).toBe(true)
    expect(dirty()).toBe(false)
    expect(store().selectedDayId).toBe(draft().days[0].id)
  })

  it('load() resolves false for an unknown id', async () => {
    expect(await store().load('missing')).toBe(false)
    expect(store().draft).toBeNull()
  })

  it('addDay names it "Day N" and selects it', () => {
    store().startNew()
    store().addDay()
    expect(draft().days.map((d) => d.name)).toEqual(['Day 1', 'Day 2'])
    expect(store().selectedDayId).toBe(draft().days[1].id)
  })

  it('removeDay on the last day is a no-op; otherwise selects a neighbour', () => {
    store().startNew()
    const first = draft().days[0].id
    store().removeDay(first)
    expect(draft().days).toHaveLength(1)

    store().addDay()
    const second = draft().days[1].id
    store().removeDay(second)
    expect(draft().days.map((d) => d.id)).toEqual([first])
    expect(store().selectedDayId).toBe(first)
  })

  it('addExercises skips duplicates and preserves order', () => {
    store().startNew()
    const dayId = draft().days[0].id
    store().addExercises(dayId, [ref('b'), ref('a'), ref('b')])
    store().addExercises(dayId, [ref('a'), ref('c')])
    expect(draft().days[0].exercises.map((e) => e.exerciseRef.exerciseId)).toEqual(['b', 'a', 'c'])
    expect(new Set(draft().days[0].exercises.map((e) => e.id)).size).toBe(3)
  })

  it('removeExercise removes only that exercise', () => {
    store().startNew()
    const dayId = draft().days[0].id
    store().addExercises(dayId, [ref('a'), ref('b')])
    store().removeExercise(dayId, draft().days[0].exercises[0].id)
    expect(draft().days[0].exercises.map((e) => e.exerciseRef.exerciseId)).toEqual(['b'])
  })

  it('changeDayToRest empties the day', () => {
    store().startNew()
    const dayId = draft().days[0].id
    store().addExercises(dayId, [ref('a')])
    store().changeDayToRest(dayId)
    expect(draft().days[0].exercises).toEqual([])
  })

  it('commit persists and clears dirty', async () => {
    store().startNew()
    store().setName('PPL')
    store().addExercises(draft().days[0].id, [ref('a')])
    expect(dirty()).toBe(true)
    await store().commit()
    expect(dirty()).toBe(false)
    expect(draft().isNew).toBe(false)
    const tree = await programs.loadTree(draft().id)
    expect(tree?.program.name).toBe('PPL')
    expect(tree?.days[0].exercises).toHaveLength(1)
  })

  it('commit({ activate: true }) makes it the only active program', async () => {
    store().startNew()
    await store().commit({ activate: true })
    const first = draft().id
    store().reset()

    store().startNew()
    await store().commit({ activate: true })
    const second = draft().id

    const live = await programs.listLive()
    expect(live.filter((p) => p.isActive).map((p) => p.id)).toEqual([second])
    expect(live.some((p) => p.id === first && !p.isActive)).toBe(true)
    expect(draft().isActive).toBe(true)
    expect(dirty()).toBe(false)
  })

  it('applyPersistedFlags({ isActive: false }) does not make the draft dirty', async () => {
    store().startNew()
    await store().commit({ activate: true })
    await programs.deactivate(draft().id)
    store().applyPersistedFlags({ isActive: false })
    expect(draft().isActive).toBe(false)
    expect(dirty()).toBe(false)
  })
})
