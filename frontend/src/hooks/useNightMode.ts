import { useCallback, useState } from 'react'
import { CONFIG } from '../lib/config'
import { useNow } from './useNow'

export type NightOverride = 'auto' | 'on' | 'off'

/**
 * Modo noturno: automático pelo horário (CONFIG.nightStartHour → nightEndHour),
 * com possibilidade de forçar ligado/desligado (tecla N).
 */
export function useNightMode(windDown?: string | null) {
  const now = useNow(30_000) // checa a cada 30 s, suficiente para virar o horário
  const [override, setOverride] = useState<NightOverride>('auto')

  const h = now.getHours()
  const { nightStartHour: start, nightEndHour: end } = CONFIG
  let autoNight = start > end ? h >= start || h < end : h >= start && h < end
  // Desaceleração do sono: a tela já esquenta/escurece a partir da hora configurada (até o fim da noite).
  if (windDown && /^\d\d:\d\d$/.test(windDown)) {
    const mins = h * 60 + now.getMinutes()
    const wd = Number(windDown.slice(0, 2)) * 60 + Number(windDown.slice(3))
    if (mins >= wd) autoNight = true
  }
  const night = override === 'auto' ? autoNight : override === 'on'

  const cycle = useCallback(
    () => setOverride((o) => (o === 'auto' ? 'on' : o === 'on' ? 'off' : 'auto')),
    [],
  )

  return { night, override, cycle }
}
