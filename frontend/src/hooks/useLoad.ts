import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

/**
 * Carrega dados de uma função assíncrona (chamada à API) e recarrega quando
 * `deps` mudam. Devolve também `reload` e uma função `set` para atualizar
 * localmente quando a própria resposta de uma ação já traz o dado novo.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, set] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const alive = useRef(true)

  const reload = useCallback(() => {
    fnRef
      .current()
      .then((d) => {
        if (!alive.current) return
        set(d)
        setError(null)
      })
      .catch((e: Error) => alive.current && setError(e.message))
      .finally(() => alive.current && setLoading(false))
  }, [])

  useEffect(() => {
    alive.current = true
    reload()
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload, set }
}
