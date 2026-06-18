import { useCallback, useEffect, useRef, useState } from 'react'

// Module-level cache. Persists across component unmount/remount (e.g. when
// navigating between routes), which is what makes revisiting a page instant.
const store = new Map()

/**
 * Stale-while-revalidate data hook.
 *
 * - On mount, if `key` has a cached value, it is returned IMMEDIATELY with
 *   `loading=false` and a background refetch is kicked off (`refreshing=true`).
 * - If there is no cached value, `loading=true` and we fetch.
 * - Successful results are written to the module-level cache under `key`.
 * - `refetch()` forces a fetch (used by manual Refresh buttons). It does not
 *   flip `loading` when data already exists, so the table/cards stay visible.
 *
 * @param {string} key            cache key (include any filter params)
 * @param {() => Promise<any>} fetcher
 * @param {{ refetchInterval?: number }} [opts]
 */
export function useCachedResource(key, fetcher, opts = {}) {
  const { refetchInterval } = opts

  const cached = store.has(key) ? store.get(key) : undefined
  const [data, setData] = useState(cached)
  const [loading, setLoading] = useState(!store.has(key))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Keep the latest fetcher without forcing effect re-runs when callers pass
  // an inline function.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    const hadData = store.has(key)
    if (hadData) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await fetcherRef.current()
      store.set(key, result)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [key])

  useEffect(() => {
    // Sync local state to cache when the key changes (e.g. filter switch).
    if (store.has(key)) {
      setData(store.get(key))
      setLoading(false)
    } else {
      setData(undefined)
      setLoading(true)
    }
    setError(null)

    refetch()

    if (refetchInterval) {
      const t = setInterval(refetch, refetchInterval)
      return () => clearInterval(t)
    }
  }, [key, refetch, refetchInterval])

  return { data, loading, refreshing, error, refetch }
}
