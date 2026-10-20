import type { Task } from '../../../shared/types'
import { useNow } from '../hooks/useNow'
import { dueToDate } from '../lib/format'

/*
  Contagem regressiva visual (combate à "cegueira de tempo").
  Ciano (tranquilo) → âmbar (< 30 min) → âmbar pulsando (< 5 min).
  A barra enche numa janela de 60 min antes do compromisso.
*/
const WINDOW_MIN = 60

export function NextEventBar({ event }: { event: Task | null }) {
  const now = useNow(1000)
  if (!event?.dueAt || event.dueAt.length <= 10) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <div className="hud-title" style={{ color: 'var(--text-dim)', textShadow: 'none' }}>Próximo compromisso</div>
        <div className="mt-1 text-lg" style={{ color: 'var(--text-dim)' }}>Sem compromissos com horário hoje.</div>
      </div>
    )
  }
  const at = dueToDate(event.dueAt)
  const remainingMin = (at.getTime() - now.getTime()) / 60_000
  const progress = Math.min(1, Math.max(0, 1 - remainingMin / WINDOW_MIN))
  const urgent = remainingMin <= 5
  const color = remainingMin <= 30 ? 'var(--amber)' : 'var(--cyan)'
  const label = remainingMin <= 0 ? 'agora' : remainingMin < 1 ? 'menos de 1 min' : `faltam ${Math.ceil(remainingMin)} min`

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <div className="hud-title" style={{ color: 'var(--text-dim)', textShadow: 'none' }}>Próximo compromisso</div>
      <div className="mt-1 text-xl font-semibold">{event.title}</div>
      <div className="mono mt-1 text-sm" style={{ color }}>
        {at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {label}
      </div>
      <div
        className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${urgent ? 'pulse' : ''}`}
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s linear, background 0.6s ease' }}
        />
      </div>
    </div>
  )
}
