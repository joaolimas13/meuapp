import { useEffect } from 'react'

/** Mantém a tela acesa (o projetor não "dorme" com o GAIA aberto). Se o navegador não suporta, ignora. */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const request = () => {
      if (!nav.wakeLock || document.visibilityState !== 'visible') return
      nav.wakeLock.request('screen').then((l) => { lock = l }).catch(() => { /* negado: tudo bem */ })
    }
    request()
    document.addEventListener('visibilitychange', request) // o bloqueio cai ao trocar de aba; pede de novo ao voltar
    return () => {
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => undefined)
    }
  }, [])
}
