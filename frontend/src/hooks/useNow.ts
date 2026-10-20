import { useEffect, useState } from 'react'

/** Devolve a data/hora atual, atualizando a cada `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
