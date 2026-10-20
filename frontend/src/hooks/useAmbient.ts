import { useCallback, useEffect, useRef, useState } from 'react'

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const

/**
 * Modo ocioso (ambiente): após `timeoutMs` sem interação, `ambient` vira true.
 * Qualquer interação "desperta" o GAIA (ambient=false) e incrementa `wakeKey`,
 * que o orbe usa para disparar a animação de despertar.
 */
export function useAmbient(timeoutMs: number) {
  const [ambient, setAmbient] = useState(false)
  const [wakeKey, setWakeKey] = useState(0)
  const ambientRef = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const arm = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      ambientRef.current = true
      setAmbient(true)
    }, timeoutMs)
  }, [timeoutMs])

  const wake = useCallback(() => {
    if (ambientRef.current) {
      ambientRef.current = false
      setAmbient(false)
      setWakeKey((k) => k + 1)
    }
    arm()
  }, [arm])

  /** Força o modo ambiente agora (útil para testar). */
  const sleep = useCallback(() => {
    window.clearTimeout(timer.current)
    ambientRef.current = true
    setAmbient(true)
  }, [])

  useEffect(() => {
    WAKE_EVENTS.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    arm()
    return () => {
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, wake))
      window.clearTimeout(timer.current)
    }
  }, [wake, arm])

  return { ambient, wakeKey, sleep }
}
