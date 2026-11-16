import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getFilterOptions } from '@/exercises/filtering'
import type { LibraryFilters } from '@/exercises/filtering'
import type { Facet } from '@/components/library/types'

type Patch = Partial<Record<'q' | Facet, string | null>>

/**
 * Search query and filters of an exercise list, kept in the URL (`q`,
 * `muscle`, `category`, `equipment`; replace, so typing never grows the
 * history stack) so Back from an exercise page restores them. Only these
 * four keys are touched: other params on the URL (a picker's `?day=`) survive.
 *
 * The query lives in local state so the input stays synchronous (router state
 * commits asynchronously and would drop characters and move the caret). The
 * URL is a write-only mirror: read once on mount, never synced back into the
 * input.
 */
export function useSearchParamsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterOptions = useMemo(() => getFilterOptions(), [])
  const facetOptions: Record<Facet, string[]> = {
    muscle: filterOptions.muscles,
    category: filterOptions.categories,
    equipment: filterOptions.equipment,
  }

  const [query, setQueryState] = useState(() => searchParams.get('q') ?? '')
  const filters = useMemo<LibraryFilters>(() => {
    // Unknown values in a hand-edited URL are ignored.
    const read = (name: Facet, options: string[]) => {
      const value = searchParams.get(name)
      return value !== null && options.includes(value) ? value : null
    }
    return {
      muscle: read('muscle', filterOptions.muscles),
      category: read('category', filterOptions.categories),
      equipment: read('equipment', filterOptions.equipment),
    }
  }, [searchParams, filterOptions])

  const update = (patch: Patch) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        for (const [name, value] of Object.entries(patch)) {
          if (value) next.set(name, value)
          else next.delete(name)
        }
        return next
      },
      { replace: true },
    )
  }

  return {
    query,
    setQuery: (value: string) => {
      setQueryState(value)
      update({ q: value })
    },
    filters,
    facetOptions,
    setFacet: (facet: Facet, value: string | null) => update({ [facet]: value }),
    reset: () => {
      setQueryState('')
      update({ q: null, muscle: null, category: null, equipment: null })
    },
  }
}
