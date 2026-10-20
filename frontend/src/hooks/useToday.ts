import { useEffect } from 'react'
import { api } from '../lib/api'
import { useLoad } from './useLoad'

/** "Hoje" vindo do backend. Recarrega quando `version` muda (algo foi alterado) e a cada 30 s. */
export function useToday(version: number) {
  const r = useLoad(api.today, [version])
  const { reload } = r
  useEffect(() => {
    const t = setInterval(reload, 30_000)
    return () => clearInterval(t)
  }, [reload])
  return r
}
