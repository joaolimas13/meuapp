import type { Task, TodayView } from '../../../shared/types'
import { addDaysStr, formatDue } from '../lib/format'
import { Panel } from './Panel'

/*
  Regra "zero culpa": atrasado NUNCA vira lista vermelha de fracassos.
  Aparece em âmbar suave com "Remarcar?" e uma sugestão (amanhã, mesmo horário ou 10:00).
*/
export function RemindersPanel({
  today, onComplete, onReschedule, delay,
}: {
  today: TodayView
  onComplete: (id: number) => void
  onReschedule: (id: number, dueAt: string) => void
  delay?: number
}) {
  const suggest = (t: Task) => `${addDaysStr(today.date, 1)}T${t.dueAt && t.dueAt.length > 10 ? t.dueAt.slice(11, 16) : '10:00'}`
  const rows = [...today.overdue.slice(0, 3), ...today.dueToday.slice(0, 4)]
  const hidden = today.overdue.length + today.dueToday.length - rows.length

  return (
    <Panel title="Lembretes" delay={delay}>
      {rows.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Tudo em dia. Respire fundo.</p>}
      <ul className="space-y-3">
        {rows.map((t) => {
          const late = today.overdue.some((o) => o.id === t.id)
          const s = suggest(t)
          return (
            <li key={t.id} className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg">{t.title}</div>
                <div className="mono text-xs" style={{ color: late ? 'var(--amber)' : 'var(--text-dim)' }}>
                  {late ? `Remarcar? Sugestão: ${formatDue(s, today.date)}` : formatDue(t.dueAt, today.date)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {late && <button type="button" className="hud-btn warn" onClick={() => onReschedule(t.id, s)}>Remarcar</button>}
                <button type="button" className="hud-btn" onClick={() => onComplete(t.id)}>Feito</button>
              </div>
            </li>
          )
        })}
      </ul>
      {hidden > 0 && <p className="mono mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>+{hidden} na aba Tarefas</p>}
    </Panel>
  )
}
