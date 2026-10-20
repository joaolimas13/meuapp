import { useEffect, useRef } from 'react'
import type { Alert } from '../../../shared/types'
import { api } from '../lib/api'
import { CONFIG } from '../lib/config'
import { playCue, speak } from '../lib/sound'
import { useLoad } from './useLoad'

/** Frase falada pelo GAIA para cada alerta (mais firme conforme o nível). */
export function spokenText(a: Alert): string {
  if (a.kind === 'before') return `Faltam ${a.minutes} minutos para: ${a.title}. Hora de se preparar.`
  if (a.level >= 3) return `${CONFIG.userName}, isto continua pendente: ${a.title}. Já passam ${a.minutes} minutos. Diga feito, adiar ou cancelar.`
  return `${CONFIG.userName}, é hora de: ${a.title}.`
}

/**
 * Consulta os alertas a cada 10 s. Quando a "chave" de um alerta muda (novo alerta ou nível
 * mais alto), toca o som e, a partir do nível 2, o GAIA fala. Cada chave dispara só uma vez.
 */
export function useAlerts(version: number) {
  const r = useLoad(api.alerts, [version])
  const { reload } = r
  const fired = useRef(new Set<string>())

  useEffect(() => {
    const t = setInterval(reload, 10_000)
    return () => clearInterval(t)
  }, [reload])

  useEffect(() => {
    for (const a of r.data?.alerts ?? []) {
      if (a.level < 1 || fired.current.has(a.key)) continue
      fired.current.add(a.key)
      playCue(a.level >= 3 ? 'alert3' : a.level === 2 ? 'alert2' : 'alert1')
      if (a.level >= 2) setTimeout(() => speak(spokenText(a)), 900)
      break // um alerta sonoro por vez (o mais urgente); os outros disparam na próxima rodada
    }
  }, [r.data])

  return r
}
