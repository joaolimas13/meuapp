import { motion } from 'framer-motion'
import type { Alert } from '../../../shared/types'
import { audioReady, unlockAudio } from '../lib/sound'

interface Props {
  alerts: Alert[]
  onDone: (id: number) => void
  onSnooze: (id: number, minutes: number) => void
  onCancel: (id: number) => void
}

/*
  Alerta visual: aparece no topo. Nível 0 = discreto (borda ciano). Nível 1+ = âmbar pulsando.
  Sempre com as três saídas do spec: Feito, Adiar e Cancelar.
*/
export function AlertBanner({ alerts, onDone, onSnooze, onCancel }: Props) {
  const top = alerts[0]
  if (!top) return null
  const hot = top.level >= 1
  const text =
    top.kind === 'before'
      ? `Faltam ${top.minutes} min · hora de se preparar`
      : top.minutes === 0
        ? 'Agora'
        : `Há ${top.minutes} min no horário · sem pressão, só não esquecer`
  return (
    <motion.div
      role="alert"
      className={`hud-panel left-1/2 top-12 z-40 w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 p-4 ${hot ? 'pulse' : ''}`}
      style={{ position: 'fixed', background: 'rgba(3,14,20,.94)', borderColor: hot ? 'var(--amber)' : 'var(--line)', boxShadow: hot ? '0 0 24px rgba(255,179,0,.35)' : undefined }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="hud-title" style={{ color: hot ? 'var(--amber)' : 'var(--cyan)' }}>
        {top.kind === 'before' ? 'Lembrete' : 'É hora'}{alerts.length > 1 ? ` · +${alerts.length - 1}` : ''}
      </div>
      <div className="mt-1 text-2xl font-semibold" data-testid="alert-title">{top.title}</div>
      <div className="mono text-sm" style={{ color: 'var(--text-dim)' }}>{text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="hud-btn primary" onClick={() => { unlockAudio(); onDone(top.taskId) }}>Feito</button>
        <button type="button" className="hud-btn" onClick={() => { unlockAudio(); onSnooze(top.taskId, 10) }}>Adiar 10 min</button>
        <button type="button" className="hud-btn" onClick={() => onCancel(top.taskId)}>Cancelar</button>
        {hot && !audioReady() && <span className="mono self-center text-xs" style={{ color: 'var(--amber)' }}>toque em qualquer botão para ativar o som</span>}
      </div>
    </motion.div>
  )
}
