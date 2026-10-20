import { useEffect, useState } from 'react'
import { getHealth } from '../lib/api'

export interface AiStatus {
  label: string
  ok: boolean
}

/** Consulta o backend a cada 20 s para mostrar o estado da IA na barra de status. */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>({ label: 'IA: VERIFICANDO', ok: false })

  useEffect(() => {
    let alive = true
    const check = () =>
      getHealth()
        .then((h) => {
          if (!alive) return
          setStatus(
            h.ai.configured
              ? { label: `IA ONLINE · ${h.ai.provider.toUpperCase()}`, ok: true }
              : { label: 'IA SEM CHAVE (backend/.env)', ok: false },
          )
        })
        .catch(() => alive && setStatus({ label: 'BACKEND OFFLINE', ok: false }))
    check()
    const id = window.setInterval(check, 20_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  return status
}
