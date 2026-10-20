import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { longDate } from '../lib/format'
import { ErrorLine } from './ErrorLine'

/** Plano sugerido do dia + revisão do dia. O plano é só sugestão: nada é remarcado sozinho. */
export function DayTab({ version, onChanged }: { version: number; onChanged: () => void }) {
  const plan = useLoad(api.plan, [version])
  const review = useLoad(api.review, [version])
  const p = plan.data
  const r = review.data
  const hm = (s: string) => s.slice(11, 16)

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" data-testid="day-tab">
      <ErrorLine msg={plan.error ?? review.error} />
      <section>
        <h3 className="hud-title mb-1">Plano sugerido{p ? ` · ${longDate(p.date)}` : ''}</h3>
        {p?.workDay && <p className="mono text-xs" style={{ color: 'var(--amber)' }}>Dia de plantão: plano leve, no máximo 2 tarefas flexíveis.</p>}
        {p && p.blocks.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Nada para encaixar hoje.</p>}
        <ul className="space-y-1">
          {p?.blocks.map((b) => (
            <li key={b.taskId} className="flex gap-3">
              <span className="mono" style={{ color: b.fixed ? 'var(--amber)' : 'var(--cyan)' }}>{hm(b.start)}–{hm(b.end)}</span>
              <span>{b.title}{b.fixed ? ' · horário marcado' : ''}</span>
            </li>
          ))}
        </ul>
        {p && p.unplaced.length > 0 && (
          <p className="mono mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>Fica para outro momento: {p.unplaced.map((u) => u.title).join(', ')}</p>
        )}
        <button type="button" className="hud-btn mt-2" onClick={() => { plan.reload(); review.reload(); onChanged() }}>Atualizar</button>
      </section>

      <section>
        <h3 className="hud-title mb-1">Revisão do dia</h3>
        {r && (
          <div className="space-y-2">
            <div>
              {r.done.length === 0 ? <span style={{ color: 'var(--text-dim)' }}>Ainda nada concluído hoje, e tudo bem.</span> : <>Você concluiu <b>{r.done.length}</b>: {r.done.join(', ')}.</>}
            </div>
            <div className="mono text-sm" style={{ color: 'var(--text-dim)' }}>Evolução hoje: {r.score}/100 · {r.pending} tarefa(s) em aberto</div>
            {r.toReschedule.length > 0 && <div style={{ color: 'var(--amber)' }}>Para remarcar: {r.toReschedule.map((t) => t.title).join(', ')}</div>}
            {r.tomorrow.length > 0 && (
              <div>
                <div className="hud-title">Sugestão para amanhã</div>
                <ul className="list-disc pl-5">{r.tomorrow.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
