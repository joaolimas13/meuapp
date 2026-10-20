import { useEffect, useState } from 'react'

/**
 * Mede os quadros por segundo nos primeiros segundos. Se a máquina não aguenta
 * (menos de 28 fps), sugere o modo leve. Só mede com a aba visível.
 */
export function useAutoLite(enabled: boolean): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let frames = 0
    let start = 0
    let rounds = 0
    const tick = (t: number) => {
      if (document.visibilityState !== 'visible') { start = 0; frames = 0; raf = requestAnimationFrame(tick); return }
      if (!start) start = t
      frames++
      if (t - start >= 3000) {
        const fps = (frames * 1000) / (t - start)
        if (fps < 28) { setSlow(true); return } // detectou: para de medir
        if (++rounds >= 2) return // duas medições boas bastam
        start = 0
        frames = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return enabled && slow
}
