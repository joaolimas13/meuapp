import { useCallback, useState } from 'react'
import { CONFIG } from '../lib/config'
import { useNow } from './useNow'

export type NightOverride = 'auto' | 'on' | 'off'

/**
 * Modo noturno: automático pelo horário (CONFIG.nightStartHour → nightEndHour),
 * com possibilidade de forçar ligado/desligado (tecla N).
 */
export function useNightMode() {
  const now = useNow(30_000) // checa a cada 30 s, suficiente para virar o horário
  const [override, setOverride] = useState<NightOverride>('auto')

  const h = now.getHours()
  const { nightStartHour: start, nightEndHour: end } = CONFIG
  const autoNight = start > end ? h >= start || h < end : h >= start && h < end
  const night = override === 'auto' ? autoNight : override === 'on'

  const cycle = useCallback(
    () => setOverride((o) => (o === 'auto' ? 'on' : o === 'on' ? 'off' : 'auto')),
    [],
  )

  return { night, override, cycle }
}
